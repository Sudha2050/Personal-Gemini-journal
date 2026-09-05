const a = { location: undefined, nested: { b: undefined, c: 2 }, arr: [undefined, 3] };
console.log(JSON.parse(JSON.stringify(a)));
