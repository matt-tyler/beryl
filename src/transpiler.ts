
import ts from "typescript"
import camelCase from "lodash.camelcase"
import { toASCII } from "punycode";
import { isUndefined } from "util"

export module transpiler {

    function GetRecordTypeAliasStatement(scenarioOutline: ScenarioOutline): ts.Statement {
        const headers = scenarioOutline.examples[0]
            .tableHeader.cells.map(c => c.value)
        
        const recordType = ts.createTypeReferenceNode(
            ts.createIdentifier("Record"),
            [
                ts.createUnionTypeNode(
                    headers.map(h => ts.createTypeReferenceNode(ts.createIdentifier(h), []))
                ),
                ts.createTypeReferenceNode("string", NO_TYPE_ARGUMENTS)
            ]
        )
        
        const typeAliasDeclaration = ts.createTypeAliasDeclaration(
            NO_DECORATORS,
            NO_MODIFIERS,
            ts.createIdentifier("Row"),
            NO_TYPE_PARAMETERS,
            recordType
        )

        return typeAliasDeclaration
    }

    function GetWorldDeclaration() {
        return ts.createVariableDeclarationList(
            single(ts.createVariableDeclaration(
                "world",
                ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
            )),
            ts.NodeFlags.Const
        )
    }

    function GetFailDeclaration() {
        return ts.createVariableDeclarationList(
            single(ts.createVariableDeclaration(
                "fail",
                ts.createFunctionTypeNode(
                    NO_TYPE_PARAMETERS,
                    single(ts.createParameter(
                        NO_DECORATORS,
                        NO_MODIFIERS,
                        undefined,
                        ts.createIdentifier("msg"),
                        undefined,
                        ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
                    )),
                    ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword)
                )
            )), 
            ts.NodeFlags.Const 
        )
    }

    function GetFailStatement() {
        return ts.createStatement(ts.createCall(
            ts.createIdentifier("fail"),
            NO_TYPE_ARGUMENTS,
            single(ts.createLiteral("Not implemented."))
        ))
    }

    function GetModuleStatements(...scenarioDefinitions: Array<ScenarioDefinition>): Array<ts.Statement> {
        return scenarioDefinitions.filter(IsNotBackground)
            .map(s => {
                const moduleName = camelCase(s.name)

                const recordTypeAliasStatement = IsScenarioOutline(s) ?
                    GetRecordTypeAliasStatement(s) : undefined

                const functions = s.steps.map(step => {
                    return ts.createFunctionDeclaration(
                        NO_DECORATORS,
                        [
                            ts.createToken(ts.SyntaxKind.ExportKeyword),
                            ts.createToken(ts.SyntaxKind.AsyncKeyword)
                        ],
                        NO_ASTERIX,
                        camelCase(step.keyword.concat(step.text)),
                        NO_TYPE_PARAMETERS,
                        [
                            ts.createParameter(
                                NO_DECORATORS,
                                NO_MODIFIERS,
                                undefined,
                                ts.createIdentifier("row"),
                                undefined,
                                ts.createTypeReferenceNode(ts.createIdentifier("Row"), NO_TYPE_ARGUMENTS)
                            )
                        ],
                        ts.createTypeReferenceNode(
                            "Promise",
                            single(ts.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword))
                        ),
                        ts.createBlock(single(GetFailStatement()), true)
                    )
                })

                const statements = Array<ts.Statement | undefined>().concat(
                    recordTypeAliasStatement,
                    ...functions
                ).filter(IsDefined)

                return ts.createModuleDeclaration(
                    NO_DECORATORS,
                    single(ts.createToken(ts.SyntaxKind.ExportKeyword)),
                    ts.createIdentifier(moduleName),
                    ts.createModuleBlock(statements)
                )
            }) 
    }
    
    export function CreateSuite(ast: GherkinDocument): ReadonlyArray<ts.Statement> {
        const declarations = [
            GetWorldDeclaration(),
            GetFailDeclaration()
        ].map(d => ts.createVariableStatement(single(ts.createToken(ts.SyntaxKind.DeclareKeyword)), d))

        const moduleStatements = GetModuleStatements(
            ...ast.feature.children)

        return new Array<ts.Statement>(...declarations)
            .concat(moduleStatements)
    }

    function GetBackgroundStatements(...backgroundStatements: Background[]): Array<ts.Statement> {
        return backgroundStatements.map(b => {
            const fnCalls = b.steps.map(s => {
                const name = `${b.name}.${camelCase(s.keyword.concat(s.text))}`
                return ts.createAwait(
                    ts.createCall(
                        ts.createIdentifier(name),
                        NO_TYPE_ARGUMENTS,
                        NO_ARGUMENTS
                    )
                )
            })
            const doneCall = ts.createStatement(ts.createCall(
                ts.createIdentifier("done"),
                NO_TYPE_ARGUMENTS,
                NO_ARGUMENTS
            ))
            return ts.createStatement(ts.createCall(
                ts.createIdentifier("env.BeforeAll"),
                NO_TYPE_ARGUMENTS,
                single(
                    ts.createArrowFunction(
                        single(ts.createToken(ts.SyntaxKind.AsyncKeyword)),
                        NO_TYPE_PARAMETERS,
                        single(
                            ts.createParameter(
                                NO_DECORATORS,
                                NO_MODIFIERS,
                                undefined,
                                ts.createIdentifier("done"),
                                undefined,
                                undefined, //fix this
                                undefined
                            )
                        ),
                        NO_RETURN_TYPE,
                        undefined,
                        ts.createBlock(
                            fnCalls.map(ts.createStatement).concat(doneCall),
                            true
                        )
                    )
                )
            ))
        })
    }

    function GetTable(examples: Examples): ts.ArrayLiteralExpression {
        const keys = examples.tableHeader.cells.map(c => c.value)    
        const table = ts.createArrayLiteral(
            examples.tableBody.map((t, i) => {
                return ts.createObjectLiteral(
                    t.cells.map((c, i) => ts.createPropertyAssignment(keys[i], ts.createLiteral(c.value))),
                    true
                )
            }), true
        )
        return table
    }

    function GetItStatement(step: Step, desc: string) {
        const text = step.keyword.concat(step.text)
        const doneCall = ts.createCall(ts.createIdentifier("done"),
            NO_TYPE_ARGUMENTS, NO_ARGUMENTS)

        const awaitExpr = ts.createAwait(
            ts.createCall(
                ts.createPropertyAccess(
                    ts.createIdentifier(camelCase(desc)),
                    camelCase(text)
                ),
                NO_TYPE_ARGUMENTS,
                single(ts.createIdentifier("row"))
            )
        )
            
        const fn = ts.createArrowFunction(
            single(ts.createToken(ts.SyntaxKind.AsyncKeyword)),
            NO_TYPE_PARAMETERS,
            single(ts.createParameter(
                NO_DECORATORS,
                NO_MODIFIERS,
                undefined,
                ts.createIdentifier("done"),
                undefined,
                NO_RETURN_TYPE
            )),
            NO_RETURN_TYPE,
            undefined,
            ts.createBlock([awaitExpr, doneCall].map(ts.createStatement), true)
        )

        return ts.createCall(
            ts.createIdentifier("env.It"),
            NO_TYPE_ARGUMENTS,
            [
                ts.createStringLiteral(text),
                fn
            ]
        )
    }

    function GetScenarioOutlineStatements(...scenarioOutline: ScenarioOutline[]): Array<ts.Statement> {
        const statements = scenarioOutline.map(sc => {
            const tableCall = ts.createPropertyAccess(GetTable(sc.examples[0]), "forEach")
            const its = sc.steps.map(st => GetItStatement(st, sc.name))
            const arrow = ts.createArrowFunction(
                NO_MODIFIERS,
                NO_TYPE_PARAMETERS,
                single(ts.createParameter(
                    NO_DECORATORS,
                    NO_MODIFIERS,
                    undefined,
                    ts.createIdentifier("row"),
                    undefined,
                    NO_RETURN_TYPE
                )),
                NO_RETURN_TYPE,
                undefined,
                ts.createBlock(its.map(ts.createStatement), true)
            )
            return ts.createCall(tableCall, NO_TYPE_ARGUMENTS, single(arrow))
        })
        return statements.map(ts.createStatement)
    }

    function GetScenarioStatements(...scenarioDefinitions: ScenarioDefinition[]): Array<ts.Statement> {
        const backgroundStatements = 
            GetBackgroundStatements(...scenarioDefinitions.filter(IsBackground))

        const scenarioOutlineStatements =
            GetScenarioOutlineStatements(...scenarioDefinitions.filter(IsScenarioOutline))

        return new Array<ts.Statement>(...backgroundStatements)
            .concat(...scenarioOutlineStatements)
    }

    export function CreateRunner(ast: GherkinDocument): ReadonlyArray<ts.Statement> {
        const declarations = [
            GetWorldDeclaration()
        ].map(d => ts.createVariableStatement(single(ts.createToken(ts.SyntaxKind.DeclareKeyword)), d))

        const describe = ts.createCall(
            ts.createIdentifier("env.Describe"),
            NO_TYPE_ARGUMENTS,
            [
                ts.createStringLiteral(ast.feature.name),
                ts.createArrowFunction(
                    NO_MODIFIERS,
                    NO_TYPE_PARAMETERS,
                    NO_PARAMETERS,
                    NO_RETURN_TYPE,
                    undefined,
                    ts.createBlock(
                        GetScenarioStatements(...ast.feature.children),
                        true
                    )
                )
            ]
        )

        const runner = ts.createFunctionDeclaration(
            NO_DECORATORS,
            single(ts.createToken(ts.SyntaxKind.ExportKeyword)),
            NO_ASTERIX,
            ts.createIdentifier("GetSuite"),
            NO_TYPE_ARGUMENTS,
            single(ts.createParameter(
                NO_DECORATORS,
                NO_MODIFIERS,
                undefined,
                "env",
                undefined,
                ts.createTypeReferenceNode("jasmine.Env", NO_TYPE_ARGUMENTS)
            )),
            ts.createTypeReferenceNode("jasmine.SuiteOrSpec", undefined),
            ts.createBlock(single(ts.createStatement(describe)), true)
        )

        return new Array<ts.Statement>(...declarations)
            .concat(runner)
    }

    export function CreateSource(filename: string, statements: ReadonlyArray<ts.Statement>) {
        const file = ts.createSourceFile(
            filename,
            "",
            ts.ScriptTarget.Latest,
            false,
            ts.ScriptKind.TS
        )

        const printer = ts.createPrinter({
            newLine: ts.NewLineKind.LineFeed
        })

        return printer.printList(
            ts.ListFormat.MultiLine,
            ts.createNodeArray(statements),
            file
        )
    }
}


const empty = <T>() => new Array<T>()
const single = <T>(a: T) => new Array<T>(a)

const NO_DECORATORS = empty<ts.Decorator>()
const NO_MODIFIERS = empty<ts.Modifier>()
const NO_TYPE_PARAMETERS = empty<ts.TypeParameterDeclaration>()
const NO_PARAMETERS = empty<ts.ParameterDeclaration>()
const NO_ARGUMENTS = empty<ts.Expression>()
const NO_TYPE_ARGUMENTS = undefined
const NO_RETURN_TYPE = undefined
const NO_ASTERIX = undefined

function IsBackground(scenarioDefinition: ScenarioDefinition): scenarioDefinition is Background {
    return scenarioDefinition.type === "Background"
}

function IsScenario(scenarioDefinition: ScenarioDefinition): scenarioDefinition is Scenario {
    return scenarioDefinition.type === "Scenario"
}

function IsScenarioOutline(scenarioDefinition: ScenarioDefinition): scenarioDefinition is ScenarioOutline {
    return scenarioDefinition.type === "ScenarioOutline"
}

function IsNotBackground(scenarioDefinition: ScenarioDefinition): scenarioDefinition is Scenario | ScenarioOutline {
    return IsScenario(scenarioDefinition) || IsScenarioOutline(scenarioDefinition)
}

function IsDefined<T>(arg: T | undefined): arg is T {
    return !isUndefined(arg)
}