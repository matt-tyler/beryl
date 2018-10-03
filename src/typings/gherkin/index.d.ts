
interface GherkinDocument {
    type: "GherkinDocument"
    comments: Array<string>    
    feature: Feature
}

interface Feature {
    type: "Feature"
    keyword: "Feature"
    language: string
    name: string
    description: string
    children: Array<ScenarioDefinition>
}

interface ScenarioDefinition {
    type: "Background" | "Scenario" | "ScenarioOutline"
    keyword: string
    name: string
    description: string
    steps: Array<Step>
}

interface Step {
    type: "Step"
    keyword: "Given " | "When " | "Then " | "And "
    text: string
    argument: DataTable
}

interface Examples {
    type: "Examples"
    keyword: "Examples"
    name: string
    description: string
    tableHeader: TableRow
    tableBody: Array<TableRow>
}

interface DataTable {
    type: "DataTable"
    rows: Array<TableRow>
}

interface TableRow {
    type: "TableRow"
    cells: Array<TableCell>
}

interface TableCell {
    type: "TableCell"
    value: string
}

interface Scenario extends ScenarioDefinition {
    type: "Scenario"
    keyword: "Scenario"    
    tags: Array<string>
}

interface ScenarioOutline extends ScenarioDefinition {
    type: "ScenarioOutline"
    keyword: "ScenarioOutline"
    tags: Array<string>
    examples: Array<Examples>
}

interface Background extends ScenarioDefinition {
    type: "Background"
    keyword: "Background"
    steps: Array<Step>
}