const { log } = require("console");
const vscode = require("vscode");

function snakeToCamel(text) {
  return text.replace(/_([a-z])/g, function (_, group1) {
    return group1.toUpperCase();
  });
}

function camelToSnake(text) {
  return text.replace(/([a-z])([A-Z])/g, function (_, lower, upper) {
    return lower + "_" + upper.toLowerCase();
  });
}

function snakeToPascal(text) {
  const camel = snakeToCamel(text);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function camelToPascal(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function pascalToCamel(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function pascalToSnake(text) {
  let snake = camelToSnake(pascalToCamel(text)); // Convert PascalCase to snake_case
  
  return snake.toLowerCase(); // Convert the entire string to lowercase
}



function detectNamingStyle(text) {
  const camelCaseRegex = /\b[a-z]+[A-Z][a-zA-Z]*\b/g;
  const words = text.split('_');
  const pascalCaseRegex = /\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b/g;


  if (words.length > 1) {
    return "snake_case";
  }
 else if (camelCaseRegex.test(text)) {
    return "camelCase";
  } 
  else if (pascalCaseRegex.test(text)) {
    return "pascalCase";
  }

  
}



async function formatSelectedCode(editor) {
  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage("Please select a function name to format.");
    return;
  }

  const selectedText = editor.document.getText(selection);

  // Extract the function name from the selected text (you may need to refine this logic)
  const functionName = selectedText.trim();
  if (!functionName) {
    vscode.window.showErrorMessage("Selected text does not appear to be a function name.");
    return;
  }

  const selectedStyle = detectNamingStyle(functionName);
  console.log(selectedStyle);
  const documentStyle = detectNamingStyle(editor.document.getText());
  console.log(documentStyle);

  const styleConversion = {
    snake_case: {
      camelCase: camelToSnake,
      pascalCase: pascalToSnake,
    },
    camelCase: {
      snake_case: snakeToCamel,
      pascalCase: pascalToCamel,
    },
    pascalCase: {
      snake_case: snakeToPascal,
      camelCase: camelToPascal,
    },
  };

  if (
    selectedStyle !== documentStyle &&
    styleConversion[documentStyle] &&
    styleConversion[documentStyle][selectedStyle]
  ) {
    const conversionFunction = styleConversion[documentStyle][selectedStyle];
    const convertedText = conversionFunction(functionName);

    // Replace only the selected function name with the converted name
    editor.edit((editBuilder) => {
      editBuilder.replace(selection, convertedText);
    });

    // Save the formatted code to a file
    const savedFileName = await saveFormattedCodeToFile(convertedText);
    if (savedFileName) {
      vscode.window.showInformationMessage(`Formatted code saved as ${savedFileName}`);
    }
  }
}

async function saveFormattedCodeToFile(formattedCode) {
  const fileName = await vscode.window.showInputBox({
    prompt: "Enter a file name (without extension) to save the formatted code:",
    placeHolder: "formatted_code",
  });

  if (!fileName) {
    return null; // User canceled the operation
  }

  const filePath = vscode.Uri.file(
    `${vscode.workspace.rootPath}/${fileName}.js`
  );
  const fileUri = filePath.with({ scheme: "file" });

  try {
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(formattedCode));
    return `${fileName}.js`;
  } catch (error) {
    vscode.window.showErrorMessage(`Error saving the file: ${error.message}`);
    return null;
  }
}

function analyzeCode(document) {
  // Parse the code from the document.
  const code = document.getText();
  const lines = code.split("\n");

  // Initialize variables to track information.
  let functionName = "";
  let totalLineLength = 0;
  let numLines = 0;
  let indentationLevels = new Set();

  // Regular expression to match function declarations.
  const functionRegex = /(function|class)\s+(\w+)\s*\(.*\)\s*{/;

  // Iterate through each line of the code.
  for (const line of lines) {
    numLines++;
    totalLineLength += line.length;

    // Check for function declarations and extract function names.
    const functionMatch = line.match(functionRegex);
    if (functionMatch) {
      functionName = functionMatch[2];
    }

    // Calculate indentation level.
    const indentationMatch = line.match(/^(\s+)/);
    if (indentationMatch) {
      const indentation = indentationMatch[1].length;
      indentationLevels.add(indentation);
    }
  }

  // Calculate average line length.
  const avgLineLength = totalLineLength / numLines;

  // Determine the naming style using your existing function.
  const namingStyle = detectNamingStyle(functionName);

  // Create an object with the collected information.
  const analysisResult = {
    functionName,
    namingStyle,
    avgLineLength,
    indentationLevels: [...indentationLevels],
  };

  return analysisResult;
}

function generateDocumentation(analysisResult) {
  // Create a Markdown document with the analysis results.
  const documentation = `
# Code Design Documentation


- **Naming Style:** ${analysisResult.namingStyle}
- **Average Line Length:** ${analysisResult.avgLineLength.toFixed(2)} characters
- **Indentation Levels:** ${analysisResult.indentationLevels.join(", ")}


  `;

  return documentation;
}

async function createDesignDocumentation() {
  try {
    // Get the active document.
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage("No active document found.");
      return;
    }

    const document = activeEditor.document;

    // Analyze the code in the document.
    const analysisResult = analyzeCode(document);

    // Generate documentation.
    const documentation = generateDocumentation(analysisResult);

    // Create a new Untitled (unsaved) document with the documentation content.
    const doc = await vscode.workspace.openTextDocument({
      content: documentation,
      language: "markdown", // Set the language mode to Markdown.
    });

    // Show the newly created document to the user.
    vscode.window.showTextDocument(doc, { preview: false });

    vscode.window.showInformationMessage("Design documentation created.");
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating the documentation: ${error.message}`);
  }
}
function activate(context) {
  let disposable = vscode.commands.registerCommand(
    "extension.formatCode",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
      }

      formatSelectedCode(editor);
    }
    
  );
  let createDocumentationDisposable = vscode.commands.registerCommand(
    "extension.createDesignDocumentation",
    createDesignDocumentation
  );
  
    
  


  context.subscriptions.push(disposable);
  context.subscriptions.push(createDocumentationDisposable);

}

exports.activate = activate;
