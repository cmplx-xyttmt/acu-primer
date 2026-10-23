// A small calculator for the formula widget (slice 8). A lesson's formula is text the model
// wrote, so it is never run as code: this parses it into a tree and evaluates the tree, and it
// only knows numbers, the input names it's given, + - * / ^, parentheses, and the functions
// below. Anything else is a parse error, which the lesson checks report before a draft is saved.

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

export type Node =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; a: Node }
  | { k: "op"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "call"; fn: string; args: Node[] };

export class FormulaError extends Error {}

const TOKEN = /\s*(?:(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+)|([a-z_][a-z0-9_]*)|(\*\*|[-+*/^(),]))/iy;

function tokenize(src: string): string[] {
  const out: string[] = [];
  TOKEN.lastIndex = 0;
  let pos = 0;
  while (pos < src.length) {
    if (/^\s*$/.test(src.slice(pos))) break;
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m) throw new FormulaError(`can't read "${src.slice(pos).trim().slice(0, 12)}"`);
    out.push(m[1] ?? m[2] ?? (m[3] === "**" ? "^" : m[3]));
    pos = TOKEN.lastIndex;
  }
  return out;
}

/** Parses a formula. `names` are the input ids it may use. */
export function parseFormula(src: string, names: string[]): Node {
  const t = tokenize(src);
  let i = 0;
  const peek = () => t[i];
  const take = (s?: string) => {
    const x = t[i++];
    if (s !== undefined && x !== s) throw new FormulaError(`expected "${s}"${x ? ` but found "${x}"` : " at the end"}`);
    return x;
  };
  // sum := product (("+"|"-") product)* ; product := power (("*"|"/") power)* ;
  // power := unary ("^" power)? ; unary := "-" unary | atom
  const sum = (): Node => {
    let a = product();
    while (peek() === "+" || peek() === "-") a = { k: "op", op: take() as "+" | "-", a, b: product() };
    return a;
  };
  const product = (): Node => {
    let a = power();
    while (peek() === "*" || peek() === "/") a = { k: "op", op: take() as "*" | "/", a, b: power() };
    return a;
  };
  const power = (): Node => {
    const a = unary();
    if (peek() === "^") {
      take();
      return { k: "op", op: "^", a, b: power() };
    }
    return a;
  };
  const unary = (): Node => {
    if (peek() === "-") {
      take();
      return { k: "neg", a: unary() };
    }
    if (peek() === "+") take();
    return atom();
  };
  const atom = (): Node => {
    const x = take();
    if (x === undefined) throw new FormulaError("the formula ends too early");
    if (x === "(") {
      const a = sum();
      take(")");
      return a;
    }
    if (/^[\d.]/.test(x)) return { k: "num", v: Number(x) };
    if (/^[a-z_]/i.test(x)) {
      const name = x.toLowerCase();
      if (peek() === "(") {
        if (!(name in FUNCTIONS)) throw new FormulaError(`unknown function "${x}"`);
        take("(");
        const args = [sum()];
        while (peek() === ",") {
          take();
          args.push(sum());
        }
        take(")");
        return { k: "call", fn: name, args };
      }
      if (names.includes(name)) return { k: "var", name };
      if (name in CONSTANTS) return { k: "num", v: CONSTANTS[name] };
      throw new FormulaError(`unknown name "${x}" (inputs are: ${names.join(", ") || "none"})`);
    }
    throw new FormulaError(`unexpected "${x}"`);
  };
  const tree = sum();
  if (i < t.length) throw new FormulaError(`unexpected "${t[i]}"`);
  return tree;
}

export function evaluate(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case "num":
      return n.v;
    case "var":
      return vars[n.name];
    case "neg":
      return -evaluate(n.a, vars);
    case "call":
      return FUNCTIONS[n.fn](...n.args.map((a) => evaluate(a, vars)));
    case "op": {
      const a = evaluate(n.a, vars);
      const b = evaluate(n.b, vars);
      return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : a ** b;
    }
  }
}

/** Every combination of the inputs' values, for checking a formula over all of them. */
export function combinations(inputs: { id: string; values: number[] }[]): Record<string, number>[] {
  return inputs.reduce<Record<string, number>[]>(
    (acc, input) => acc.flatMap((vars) => input.values.map((v) => ({ ...vars, [input.id]: v }))),
    [{}],
  );
}
