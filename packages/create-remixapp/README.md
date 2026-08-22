# @remixapp/create

Create a remixApp project from the template bundled with this package.

```sh
npm create @remixapp@latest
```

Provide the project metadata without prompts:

```sh
npm create @remixapp@latest -- --name "My Room" --version 0.1.0
```

## License

The generator is licensed under Apache-2.0. Files copied from `template-default` into generated projects are licensed under 0BSD, allowing generated applications to adopt any license.

Options:

- `-n, --name <name>`: project name and target directory
- `-v, --version <version>`: initial project version
- `-f, --force`: use an existing directory without confirmation
- `-h, --help`: display help

Names are trimmed, converted to lowercase, and whitespace is replaced with dashes. The project is created under the normalized name in the current working directory. Existing unrelated files are preserved, and Git is not initialized.
