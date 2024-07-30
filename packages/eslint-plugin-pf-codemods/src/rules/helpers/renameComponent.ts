import { Rule } from "eslint";
import { getAllImportsFromPackage } from "./getFromPackage";
import { renamePropsOnNode } from "./renamePropsOnNode";
import { Renames } from "./renameSinglePropOnNode";
import {
  JSXAttribute,
  JSXMemberExpression,
  JSXOpeningElement,
  JSXSpreadAttribute,
  ImportSpecifier,
  Identifier,
  JSXClosingElement,
  ImportDefaultSpecifier,
} from "estree-jsx";
import {
  ImportDefaultSpecifierWithParent,
  JSXOpeningElementWithParent,
} from "./interfaces";

interface ComponentRename {
  newName: string;
  message?: string;
}

interface ComponentRenames {
  [currentName: string]: string;
}

// const foo: ComponentRenames = { Foo: { newName: "bar", dataTag: "bar" } };

function formatDefaultMessage(oldName: string, newName: string) {
  return `${oldName} has been renamed to ${newName}.`;
}

function getDeclarationString(
  defaultImportSpecifier: ImportDefaultSpecifierWithParent
) {
  return defaultImportSpecifier?.parent?.source.value?.toString();
}

function getComponentImportName(
  importSpecifier: ImportSpecifier | ImportDefaultSpecifierWithParent,
  potentialNames: string[]
) {
  if (importSpecifier.type === "ImportSpecifier") {
    return importSpecifier.imported.name;
  }

  return potentialNames.find((name) =>
    getDeclarationString(importSpecifier)?.includes(name)
  );
}

function getNodeName(node: JSXOpeningElement | JSXMemberExpression) {
  if (node.type === "JSXMemberExpression") {
    switch (node.object.type) {
      case "JSXMemberExpression":
        return getNodeName(node.object);
      case "JSXIdentifier":
        return node.object.name;
    }
  }

  switch (node.name.type) {
    case "JSXMemberExpression":
      return getNodeName(node.name);
    case "JSXIdentifier":
    case "JSXNamespacedName":
      return typeof node.name.name === "string"
        ? node.name.name
        : node.name.name.name;
  }
}

function getAttributeName(attr: JSXAttribute) {
  switch (attr.name.type) {
    case "JSXIdentifier":
      return attr.name.name;
    case "JSXNamespacedName":
      return attr.name.name.name;
  }
}

function hasCodeModDataTag(openingElement: JSXOpeningElement) {
  const nonSpreadAttributes = openingElement.attributes.filter(
    (attr) => attr.type === "JSXAttribute"
  );
  const attributeNames = nonSpreadAttributes.map((attr) =>
    getAttributeName(attr as JSXAttribute)
  );
  return attributeNames.includes("data-codemods");
}

function getFixes(
  fixer: Rule.RuleFixer,
  nodeImport: ImportSpecifier | ImportDefaultSpecifierWithParent,
  node: JSXOpeningElementWithParent,
  oldName: string,
  newName: string
) {
  const fixes = [];

  const isNamedImport = nodeImport.type === "ImportSpecifier";
  if (isNamedImport) {
    fixes.push(fixer.replaceText(nodeImport.imported, newName));
  } else {
    const importDeclaration = nodeImport.parent;
    const newImportDeclaration = importDeclaration?.source.raw?.replace(
      oldName,
      newName
    );
    if (importDeclaration && newImportDeclaration) {
      fixes.push(
        fixer.replaceText(importDeclaration.source, newImportDeclaration)
      );
    }
  }

  const shouldRenameNode =
    isNamedImport && nodeImport.imported.name === nodeImport.local.name;

  if (shouldRenameNode) {
    fixes.push(fixer.replaceText(node.name, newName));
    fixes.push(fixer.insertTextAfter(node.name, " data-codemods"));
  }

  const closingElement = node?.parent?.closingElement;
  if (shouldRenameNode && closingElement) {
    fixes.push(fixer.replaceText(closingElement.name, newName));
  }

  return fixes;
}

export function renameComponent(
  renames: ComponentRenames,
  packageName = "@patternfly/react-core"
) {
  return function (context: Rule.RuleContext) {
    const oldNames = Object.keys(renames);
    const imports = getAllImportsFromPackage(context, packageName, oldNames);

    if (imports.length === 0) {
      return {};
    }

    return {
      JSXOpeningElement(node: JSXOpeningElementWithParent) {
        if (hasCodeModDataTag(node)) {
          return;
        }

        const nodeName = getNodeName(node);
        const nodeImport = imports.find((imp) => {
          if (imp.type === "ImportSpecifier") {
            return [imp.imported.name, imp.local.name].includes(nodeName);
          }

          return oldNames.some((name) =>
            getDeclarationString(imp)?.includes(name)
          );
        });

        if (!nodeImport) {
          return;
        }

        const oldName = getComponentImportName(nodeImport, oldNames);

        if (!oldName) {
          return;
        }

        const newName = renames[oldName];

        if (!newName) {
          return;
        }

        context.report({
          node,
          message: formatDefaultMessage(oldName, newName),
          fix: (fixer) => getFixes(fixer, nodeImport, node, oldName, newName),
        });
      },
    };
  };
}
