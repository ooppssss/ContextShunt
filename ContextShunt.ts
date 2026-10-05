import { type Plugin } from "@opencode-ai/plugin"
import * as fs from "fs/promises"

export const ContextShunt: Plugin = async ({
    client,
    directory,
}) => {
    console.log("ContextShunt Initialised!")

    const logFile = `${directory}/context-shunt.log`

    const THRESHOLD = 300

    return {
        "tool.execute.before": async () => {
            // Nothing needed here for now.
        },

        "tool.execute.after": async (input, output) => {
            // Only intercept the read tool.
            if (input.tool !== "read") return

            const totalLines = output.metadata?.display?.totalLines
            const content = output.output

            await fs.appendFile(
                logFile,
                `
========== READ ==========
Lines: ${totalLines}
`,
                "utf-8",
            )

            // If OpenCode didn't provide line information,
            // leave the normal read result untouched.
            if (!totalLines) {
                await fs.appendFile(
                    logFile,
                    "No line count available. Using normal read.\n",
                    "utf-8",
                )

                return
            }

            // Small files don't need summarisation.
            if (totalLines < THRESHOLD) {
                await fs.appendFile(
                    logFile,
                    `Below threshold (${THRESHOLD}). Using normal read.\n`,
                    "utf-8",
                )

                return
            }

            await fs.appendFile(
                logFile,
                `Large read detected (${totalLines} lines). Sending to worker...\n`,
                "utf-8",
            )

            try {
                // Create a separate OpenCode session for the worker.
                const sessionResult = await client.session.create({
                    body: {
                        title: "ContextShunt Worker",
                    },
                })

                const sessionId = sessionResult.data.id

                await fs.appendFile(
                    logFile,
                    `Worker session ID: ${sessionId}\n`,
                    "utf-8",
                )

                const workerPrompt = `
You are a code-context summarization worker.

Your ONLY job is to summarize the source code below
for another AI coding agent.

Do NOT:
- modify files
- create files
- delete files
- execute commands
- suggest code changes
- solve the user's task
- reproduce the source code

Produce a compact, high-signal summary.

Include:

1. PURPOSE
- What this file is responsible for.

2. STRUCTURE
- Important classes, functions, methods, and their responsibilities.

3. DATA FLOW
- Important inputs, outputs, state, and how information moves.

4. DEPENDENCIES
- Important imports, modules, APIs, services, or files.

5. IMPORTANT LOGIC
- Key algorithms, conditions, side effects, and non-obvious behavior.

6. INTEGRATION POINTS
- How this file interacts with the rest of the application.

7. RELEVANT LOCATIONS
- Important line ranges when useful.

8. WARNINGS
- Anything another coding agent should know before modifying this file.

Keep the result concise and information-dense.
Prefer bullet points.
Preserve important names exactly as they appear.

Output ONLY the structured summary.

SOURCE CODE
------------
${content}
------------
`

                const workerResult = await client.session.prompt({
                    path: {
                        id: sessionId,
                    },

                    query: {
                        directory,
                    },

                    body: {
                        model: {
                            providerID: "opencode",
                            modelID: "nemotron-3.5-lightning-free",
                        },

                        parts: [
                            {
                                type: "text",
                                text: workerPrompt,
                            },
                        ],
                    },
                })

                // Extract only the text produced by the worker.
                const summary = workerResult.data.parts
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("\n")

                await fs.appendFile(
                    logFile,
                    `
========== WORKER SUMMARY ==========
${summary}
=====================================
`,
                    "utf-8",
                )

            } catch (error) {
                await fs.appendFile(
                    logFile,
                    `
========== WORKER ERROR ==========
${String(error)}
==================================
`,
                    "utf-8",
                )
            }
        },
    }
}