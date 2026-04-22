import { goSlopsquatting } from "./slopsquatting.js";
import { goErrorIgnored } from "./error-ignored.js";
import { goSprintfSql } from "./sprintf-sql.js";
import { goHardcodedSecret } from "./hardcoded-secret.js";

export const goDetectors = [goSlopsquatting, goErrorIgnored, goSprintfSql, goHardcodedSecret];
