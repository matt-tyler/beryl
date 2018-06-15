import { readFile } from "fs-extra"
import { transpiler } from "./transpiler"

let log = (a: any) => console.log(JSON.stringify(a, null, 2));

let gherkin = require("gherkin")
let parser = new gherkin.Parser()

readFile("./example.feature").then(buf => {
    let ast = parser.parse(buf.toString())
    let suite = transpiler.CreateSuite(ast)
    let code = transpiler.CreateSource("suite.ts", suite)
    console.log(code)
}).then((err: any) => console.log(err))

