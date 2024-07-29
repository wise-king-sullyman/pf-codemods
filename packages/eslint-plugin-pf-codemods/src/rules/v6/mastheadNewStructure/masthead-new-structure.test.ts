const ruleTester = require("../../ruletester");
import * as rule from "./masthead-new-structure";

ruleTester.run("masthead-new-structure", rule, {
  valid: [
    {
      code: `<MastheadBrand  />`,
    },
    {
      code: `<MastheadMain  />`,
    },
    {
      code: `import { MastheadBrand } from '@patternfly/react-core'; <MastheadBrand data-codemods />`,
    },
    {
      code: `import { Masthead } from '@patternfly/react-core'; <Masthead someOtherProp />`,
    },
  ],
  invalid: [
    {
      code: `import { MastheadBrand } from '@patternfly/react-core'; <MastheadBrand  />`,
      output: `import { MastheadLogo } from '@patternfly/react-core'; <MastheadLogo  />`,
      errors: [
        {
          message: `MastheadBrand has been renamed to MastheadLogo.`,
          type: "JSXOpeningElement",
        },
      ],
    },
  ],
});
