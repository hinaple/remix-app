import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import archiver from "archiver";

export async function createZipArchive(
  sourceDir: string,
  outputFile: string,
): Promise<void> {
  await fsp.mkdir(path.dirname(outputFile), { recursive: true });
  await fsp.rm(outputFile, { force: true });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}
