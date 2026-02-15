/// <reference path="../data/types.d.ts" />

console.log("[CLAIM] Loaded claim.pb.js");

routerAdd("POST", "/api/group2/claim", (requestContext) => {
	const logger = function (error) {
		console.log(`[PUSH] [LOGGER] Error processing ${requestContext.request.method} ${requestContext.request.url.path}: ${error}`);
		try {
			const collection = $app.findCollectionByNameOrId("errors");
			const record = new Record(collection);

			const stringBody = toString(requestContext.request.body);

			const payload = {
				error: error.toString(),
				context: `${requestContext.request.method} ${requestContext.request.url.path}`,
				timestamp: new Date().toISOString(),
				body: stringBody,
			};

			record.set("errorDetails", JSON.stringify(payload));
			$app.save(record);
		} catch (loggingError) {
			console.log("[PUSH] [LOGGER] Log Failed: " + loggingError.toString());
		}
	};
	// 1. Parse Body
	try {
		const stringBody = toString(requestContext.request.body);
		const parsedBody = JSON.parse(stringBody);

		if (!parsedBody || typeof parsedBody !== "object") {
			console.log("[CLAIM] Error parsing body");
			throw new Error("Error parsing body");
		}

		const data = parsedBody.data || parsedBody;

		const { participantId, responseId } = data;
		const tableName = data.tableName || "responsesGroup_1";

		if (!participantId || !participantId.trim()) {
			console.log("[CLAIM] Missing participantId");
			throw new Error("Missing participantId");
		}
		if (!responseId || !responseId.trim()) {
			console.log("[CLAIM] Missing responseId");
			throw new Error("Missing responseId");
		}

		const transactionResult = {
			failed: true,
			unavailable: false,
			recordString: "",
		};
		console.log("[CLAIM] Running transaction for participantId: ", participantId);
		$app.runInTransaction((txDao) => {
			// Find Existing Record. If yes. Flag it and Return
			const claimSteps = ["Find Existing Record", "Update Existing Record", "Find Unassigned Record", "Update Unassigned Record"];
			let currentStep = 0;
			try {
				const existingRecord = txDao.findFirstRecordByData(tableName, "assignedToParticipantId", participantId);

				if (existingRecord) {
					console.log("[CLAIM] Existing record found:", existingRecord.id);
					console.log("[CLAIM] Existing record Flagged for Group 2");
					existingRecord.set("flagGroup2", true);
					const existingRecordString = JSON.stringify(existingRecord);
					transactionResult.failed = false;
					transactionResult.recordString = existingRecordString;
					// console.log(existingRecordString);

					// Save updated record
					currentStep++;
					try {
						txDao.save(existingRecord);
						console.log("[CLAIM] Updated Existing Record");
					} catch (error) {
						const errorMessage = `[CLAIM] Error at ${claimSteps[currentStep]}: ${JSON.stringify(error)}`;
						console.log(errorMessage);
					}

					return;
				}
			} catch (error) {
				console.log("[CLAIM] No Existing Record Found");
			}

			// Else Search for unassigned
			let unassignedRecord;
			try {
				currentStep++;
				console.log("[CLAIM] Searching for unassigned record");
				unassignedRecord = txDao.findFirstRecordByData(tableName, "assigned", false);
				console.log("[CLAIM] Found unassigned record:", unassignedRecord.id);
				unassignedRecord.set("assigned", true);
				unassignedRecord.set("assignedTo", responseId);
				unassignedRecord.set("assignedToParticipantId", participantId);
				transactionResult.failed = false;
				transactionResult.recordString = JSON.stringify(unassignedRecord);
			} catch (error) {
				const errorMessage = `[CLAIM] Error at ${claimSteps[currentStep]}: ${JSON.stringify(error)}`;
				console.log(errorMessage);
			}

			// Update unassigned record
			try {
				console.log("[CLAIM] Updating Unassigned record");
				currentStep++;
				txDao.save(unassignedRecord);
				console.log("[CLAIM] Saved");
			} catch (error) {
				const errorMessage = `[CLAIM] Error at ${claimSteps[currentStep]}: ${JSON.stringify(error)}`;
				console.log(errorMessage);
			}
		});

		console.log("[CLAIM] Returning Success");
		return requestContext.json(200, {
			statusCode: 200,
			message: transactionResult.failed ? "Failed" : "Success",
			responseData: transactionResult.recordString,
			availability: !transactionResult.unavailable,
		});
	} catch (e) {
		logger(e);
		return requestContext.json(400, {
			statusCode: 400,
			message: "[CLAIM] Invalid Request Body: " + e.toString(),
		});
	}
});
