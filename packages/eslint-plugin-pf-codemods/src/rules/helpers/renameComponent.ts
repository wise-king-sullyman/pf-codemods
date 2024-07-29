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
} from "estree-jsx";

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

function getName(node: JSXOpeningElement | JSXMemberExpression) {
  if (node.type === "JSXMemberExpression") {
    switch (node.object.type) {
      case "JSXMemberExpression":
        return getName(node.object);
      case "JSXIdentifier":
        return node.object.name;
    }
  }

  switch (node.name.type) {
    case "JSXMemberExpression":
      return getName(node.name);
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

export function renameComponent(
  renames: ComponentRenames,
  packageName = "@patternfly/react-core"
) {
  return function (context: Rule.RuleContext) {
    const imports = getAllImportsFromPackage(
      context,
      packageName,
      Object.keys(renames)
    );

    if (imports.length === 0) {
      return {};
    }

    return {
      JSXOpeningElement(node: JSXOpeningElement) {
        const oldName = getName(node);
        const newName = renames[oldName];

        if (!newName) {
          return;
        }

        if (hasCodeModDataTag(node)) {
          return;
        }

        const nodeImport = imports.find(
          (imp) =>
            imp.type === "ImportSpecifier" && imp.imported.name === oldName
        );

        context.report({
          node,
          message: formatDefaultMessage(oldName, newName),
          fix: (fixer) => {
            return [
              fixer.replaceText(node.name, newName),
              fixer.replaceText(
                (nodeImport as ImportSpecifier).imported,
                newName
              ),
            ];
          },
        });
      },
    };
  };
}
