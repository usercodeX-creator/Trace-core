/**
 * Ruby Detector: Eval Injection
 *
 * Detects eval/send called with dynamic (non-literal) input, which can
 * lead to arbitrary code execution when the input is user-controlled.
 *
 * Flags:
 *   - eval(variable), instance_eval(var), class_eval(var), module_eval(var)
 *   - .send(params[...]), .public_send(params[...])
 *
 * Does NOT flag eval with string literals: eval("puts 'hello'")
 * Heuristic, regex-based.
 */

import type { Detector, DetectorContext, Detection } from "../../types.js";

const EVAL_RE =
  /\b(?:eval|instance_eval|class_eval|module_eval)\s*\(\s*(?!["':])[a-z_]/g;

const SEND_PARAMS_RE = /\.(?:send|public_send)\s*\(\s*params\[/g;

export const rubyEvalInjection: Detector = {
  id: "ruby/eval-injection" as any,
  name: "Ruby Eval Injection",
  description:
    "Detects eval/send called with dynamic input \u2014 potential code injection.",

  async run(ctx: DetectorContext): Promise<Detection[]> {
    if ((ctx.language as string) !== "ruby") return [];

    const lines = ctx.content.split("\n");
    const detections: Detection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      for (const re of [EVAL_RE, SEND_PARAMS_RE]) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(line)) !== null) {
          detections.push({
            detector: "ruby/eval-injection" as any,
            severity: "critical",
            file: ctx.filePath,
            line: i + 1,
            column: match.index + 1,
            message:
              "Dynamic eval with user-controlled input \u2014 potential code injection",
            rawCode: line.trim(),
            suggestedFix: null,
            dependencyContext: null,
            auditTrail: null,
          });
        }
      }
    }

    return detections;
  },
};
