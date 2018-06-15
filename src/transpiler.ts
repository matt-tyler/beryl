
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

    function GetFailDeclaration() {
        return ts.createVariableDeclarationList(
            single(ts.createVariableDeclaration("fail")), 
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
                        NO_RETURN_TYPE,
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
            GetFailDeclaration()
        ].map(d => ts.createVariableStatement(single(ts.createToken(ts.SyntaxKind.DeclareKeyword)), d))

        const moduleStatements = GetModuleStatements(
            ...ast.feature.children)

        return new Array<ts.Statement>(...declarations)
            .concat(moduleStatements)
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