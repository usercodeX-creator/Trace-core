# Trace examples

A gallery of deliberately-broken code samples showing what Trace
catches in real-world AI-generated output.

Each file in this directory is a single failure mode (or cluster of
related failures). They're written to look like plausible AI-generated
code — not intentionally bad, just realistically bad.

## Index

| File | Language | Detectors triggered |
|---|---|---|
| [`typescript/api-leak.ts`](typescript/api-leak.ts) | TypeScript | hallucinated-deps, credential-leak, insecure-rng, silent-exception, hardcoded-localhost, fake-type-safety, missing-await, dynamic-eval, meaningless-test |

## Running locally

```bash
npx trace-core examples/typescript/api-leak.ts
```

## Running in your CI

See [`usercodeX-creator/trace-action`](https://github.com/usercodeX-creator/trace-action).

## Contributing

Please open a PR adding new samples. Each sample should:

1. Be self-contained (no imports outside the file's own dependencies).
2. Look plausibly AI-generated, not adversarially constructed.
3. Trigger at least one detector that no other example triggers.
4. Include a one-line comment at the top explaining the scenario.
