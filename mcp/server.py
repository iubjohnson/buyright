#!/usr/bin/env python3
"""
BuyRight MCP Server — development tool for exploring Odoo data
during Claude Code sessions. Provides two tools:
  - get_sales_data: fetch stock.move records (outgoing, done)
  - get_product_master: fetch active products with on-hand and vendor
"""
import os
import json
import asyncio
import xmlrpc.client
from datetime import datetime, timedelta
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

ODOO_URL = os.environ["ODOO_URL"]
ODOO_DB  = os.environ["ODOO_DATABASE"]
ODOO_UN  = os.environ["ODOO_API_USERNAME"]
ODOO_KEY = os.environ["ODOO_API_PASSWORD"]

BATCH_SIZE = 2000


def get_models():
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    uid = common.authenticate(ODOO_DB, ODOO_UN, ODOO_KEY, {})
    if not uid:
        raise RuntimeError("Odoo authentication failed")
    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    return uid, models


def kw(models, uid, model, method, args, **kwargs):
    return models.execute_kw(ODOO_DB, uid, ODOO_KEY, model, method, args, kwargs)


def fetch_sales_data(date_from: str) -> dict:
    uid, models = get_models()
    domain = [
        ["location_dest_id.usage", "=", "customer"],
        ["state", "=", "done"],
        ["date", ">=", date_from + " 00:00:00"],
    ]
    rows = []
    offset = 0
    while True:
        batch = kw(models, uid, "stock.move", "search_read", [domain],
                   fields=["product_id", "quantity", "date", "reference"],
                   limit=BATCH_SIZE, offset=offset, order="date asc")
        rows.extend(batch)
        if len(batch) < BATCH_SIZE:
            break
        offset += BATCH_SIZE

    # Normalize
    sales = []
    for m in rows:
        if not m.get("product_id") or not m.get("quantity"):
            continue
        display = m["product_id"][1] if isinstance(m["product_id"], list) else ""
        import re
        sku_match = re.match(r"^\[([^\]]+)\]", display)
        sku = sku_match.group(1) if sku_match else str(m["product_id"][0])
        sales.append({
            "sku": sku,
            "odoo_product_id": m["product_id"][0],
            "date": m["date"],
            "qty": m["quantity"],
            "reference": m.get("reference") or "",
        })

    return {"count": len(sales), "date_from": date_from, "sales": sales}


def fetch_product_master() -> dict:
    uid, models = get_models()
    domain = [["sale_ok", "=", True], ["active", "=", True], ["default_code", "!=", False]]
    products = []
    offset = 0
    while True:
        batch = kw(models, uid, "product.product", "search_read", [domain],
                   fields=["id", "default_code", "name", "qty_available", "seller_ids"],
                   limit=BATCH_SIZE, offset=offset)
        products.extend(batch)
        if len(batch) < BATCH_SIZE:
            break
        offset += BATCH_SIZE

    all_seller_ids = list({sid for p in products for sid in p.get("seller_ids", [])})
    supplier_map = {}
    if all_seller_ids:
        suppliers = kw(models, uid, "product.supplierinfo", "read", [all_seller_ids],
                       fields=["product_id", "partner_id", "sequence"])
        for s in suppliers:
            pid = s["product_id"][0] if isinstance(s["product_id"], list) else None
            if pid is None:
                continue
            if pid not in supplier_map or s["sequence"] < supplier_map[pid]["sequence"]:
                supplier_map[pid] = {
                    "vendor": s["partner_id"][1] if isinstance(s["partner_id"], list) else "",
                    "sequence": s["sequence"],
                }

    result = []
    for p in products:
        import re
        name = re.sub(r"^\[[^\]]+\]\s*", "", p["name"])
        result.append({
            "sku": p["default_code"],
            "product_name": name,
            "on_hand": p["qty_available"],
            "vendor": supplier_map.get(p["id"], {}).get("vendor", ""),
        })

    return {"count": len(result), "products": result}


server = Server("buyright-odoo")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_sales_data",
            description=(
                "Fetch completed outgoing inventory moves from Odoo (all channels: POS, web, Amazon FBA). "
                "Returns normalized sales rows: sku, date, qty, reference. "
                "These feed directly into BuyRight's velocity calculation engine."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "date_from": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format (default: 2024-11-01)",
                        "default": "2024-11-01",
                    },
                },
            },
        ),
        Tool(
            name="get_product_master",
            description=(
                "Fetch all active saleable products from Odoo with SKU (default_code), "
                "current on-hand quantity, and primary vendor name. "
                "These feed directly into BuyRight's buy list calculation."
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        if name == "get_sales_data":
            result = fetch_sales_data(arguments.get("date_from", "2024-11-01"))
        elif name == "get_product_master":
            result = fetch_product_master()
        else:
            result = {"error": f"Unknown tool: {name}"}
    except Exception as e:
        result = {"error": str(e)}
    return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
