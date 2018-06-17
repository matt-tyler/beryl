import { readFile } from "fs-extra"
import { transpiler } from "./transpiler"

let log = (a: any) => console.log(JSON.stringify(a, null, 2));

let gherkin = require("gherkin")
let parser = new gherkin.Parser()

readFile("./example.feature").then(buf => {
    let ast = parser.parse(buf.toString())
    let suite = transpiler.CreateSuite(ast)
    let runner = transpiler.CreateRunner(ast)
    let code = transpiler.CreateSource("suite.ts", runner)
    console.log(code)
    //console.log(JSON.stringify(ast, null, 2))
}).catch((err: any) => console.log(err))

