import yaml

with open('/root/NOS-OpenAPI/nos-openapi.yaml') as f:
    spec = yaml.safe_load(f)

paths = spec.get('paths', {})
fabric = {p: v for p, v in paths.items() if 'fabric' in p.lower()}

for path, item in sorted(fabric.items()):
    for method, op in item.items():
        if method not in ('get','post','put','patch','delete'):
            continue
        print(f"{method.upper()} {path}")
        print(f"  Summary: {op.get('summary','')}")
        desc = op.get('description','')
        if desc:
            print(f"  Description: {desc[:120]}")
        rb = op.get('requestBody',{}).get('content',{}).get('application/json',{}).get('schema',{})
        props = list(rb.get('properties',{}).keys())[:10]
        if props:
            print(f"  Body fields: {props}")
        r200 = op.get('responses',{}).get('200',{}).get('content',{}).get('application/json',{}).get('schema',{})
        rprops = list(r200.get('properties',{}).keys())[:8]
        if rprops:
            print(f"  Response fields: {rprops}")
        params = [p.get('name') for p in op.get('parameters',[])[:6]]
        if params:
            print(f"  Params: {params}")
        print()
