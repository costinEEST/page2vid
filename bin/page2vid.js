#!/usr/bin/env node

import { cwd, exit } from "node:process";
import { join } from "node:path";
import { program } from "commander";

import { recordPage } from "../record.js";

program
  .name("page2vid")
  .description("Record a webpage as a video")
  .version("1.0.0");

program
  .argument("<url>", "URL of the webpage to record")
  .option("-u, --username <username>", "Username for login (if required)")
  .option("-p, --password <password>", "Password for login (if required)")
  .option(
    "-o, --output <path>",
    "Output video file path",
    join(cwd(), "output.mp4") // Default to current directory
  )
  .option("-s, --speed <milliseconds>", "Scroll speed in milliseconds", "1000")
  .action(async (url, options) => {
    const { username, password, output, speed } = options;

    try {
      console.log(`Saving video to: ${output}`);
      await recordPage(url, username, password, output, parseInt(speed, 10));
    } catch (err) {
      console.error("Error:", err.message);

      exit(1);
    }
  });

program.parse();
