import { rubyMassAssignment } from "./mass-assignment.js";
import { rubyStringInterpolationSql } from "./string-interpolation-sql.js";
import { rubySilentRescue } from "./silent-rescue.js";
import { rubyEvalInjection } from "./eval-injection.js";

export const rubyDetectors = [rubyMassAssignment, rubyStringInterpolationSql, rubySilentRescue, rubyEvalInjection];
