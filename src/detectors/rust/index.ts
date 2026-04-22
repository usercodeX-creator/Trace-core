import { rustUnwrapAbuse } from "./unwrap-abuse.js";
import { rustUnsafeBlock } from "./unsafe-block.js";
import { rustTodoMacro } from "./todo-macro.js";
import { rustPanicMacro } from "./panic-macro.js";

export const rustDetectors = [rustUnwrapAbuse, rustUnsafeBlock, rustTodoMacro, rustPanicMacro];
