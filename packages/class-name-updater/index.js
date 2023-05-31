const { Command } = require("commander");
const program = new Command();

const { classNameUpdate } = require("./classNameUpdate");

program
  .version(require("./package.json").version)
  .description("Update class name versioning")
  .arguments("<path> [otherPaths...]")
  .option("--fix", "Whether to run fixer")
  .action(runClassNameUpdate);

async function runClassNameUpdate(path, otherPaths, options) {
  const allPaths = [path, ...otherPaths];
  allPaths.forEach(async (path) => {
    await classNameUpdate(path, options.fix);
  });
}

program.parse(process.argv);
