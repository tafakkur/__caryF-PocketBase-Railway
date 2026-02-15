/// <reference path="../data/types.d.ts" />

console.log("[PUSH] Loaded push.pb.js");

routerAdd("POST", "/api/group2/push", (requestContext) => {
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

	const transformer = function (inputObj) {
		try {
			const { responseId, responseType, participantId, responseData } = inputObj;
			const lineData = responseData.split("~~~").map((lineString) => lineString.split(","));
			if (lineData.length < 2 || Math.min(...lineData.map((a) => a.length)) < 4) {
				// console.log("Line Data Length: " + lineData.length);
				// console.log("Line Data: " + JSON.stringify(lineData));
				return { error: "Malformed roundsData string" };
			}
			const trialSets = [];

			lineData.forEach((trialColumns) => {
				const trialData = {
					round_number: parseInt(trialColumns[3]),
					allocation_amount: parseFloat(trialColumns[4]),
					realized_return: parseFloat(trialColumns[5]),
					final_points: parseFloat(trialColumns[6]),
				};
				trialSets.unshift(trialData);
			});

			trialSets.forEach((trial, index) => {
				if (index === 0) {
					trial.starting_points = 1000;
				} else {
					trial.starting_points = trialSets[index - 1].final_points;
				}

				if (index === trialSets.length - 1) {
					trial.starting_points = 500;
				}

				trial.change_in_points = Number((trial.final_points - trial.starting_points).toFixed(2));
			});
			const returnObj = {
				responseId,
				participantId,
				responseType: responseType != "pilot" && responseType != "real" ? "test" : responseType,
				responseData: {
					responseId,
					participantId,
					responseType,
					initial_points: trialSets[0].starting_points,
					trialsForId: trialSets,
				},
			};

			return returnObj;
		} catch (error) {
			console.log(error);
			return { error: error.toString() };
		}
	};

	try {
		const stringBody = toString(requestContext.request.body);
		const parsedBody = JSON.parse(stringBody);

		if (!parsedBody || typeof parsedBody !== "object") {
			console.log("[PUSH] Error parsing body");
			throw new BadRequestError("Error parsing body");
		}
		if (!parsedBody.participantId || !parsedBody.participantId.trim()) {
			console.log("[PUSH] Missing participantId");
			throw new BadRequestError("Missing participantId");
		}
		if (!parsedBody.responseId || !parsedBody.responseId.trim()) {
			console.log("[PUSH] Missing responseId");
			throw new BadRequestError("Missing responseId");
		}
		if (!parsedBody.responseData || !parsedBody.responseData.trim()) {
			console.log("[PUSH] Missing responseData");
			throw new BadRequestError("Missing 'responseData' field");
		}

		const pushData = transformer(parsedBody);
		if (pushData.error) {
			console.log("[PUSH] Error transforming data: " + pushData.error);
			throw new Error("[PUSH] Error transforming data");
		}
		const { responseId, responseType, participantId, responseData } = pushData;

		try {
			console.log("[PUSH] Searching for existing record.");
			const existingRecord = $app.findFirstRecordByData("responsesGroup_1", "participantId", participantId);

			if (existingRecord) {
				console.log("[PUSH] Existing record found. Updating record.");
				const oldResponseId = existingRecord.get("responseId");
				existingRecord.set("responseId", oldResponseId + "," + pushData.responseId);
				existingRecord.set("responseData", JSON.stringify(pushData.responseData));
				existingRecord.set("flagGroup1", true);

				try {
					$app.save(existingRecord);
					console.log("[PUSH] Existing record updated.");
				} catch (error) {
					console.log("[PUSH] Error updating existing record: " + error);
				}
				return requestContext.json(200, {
					id: existingRecord.id,
					action: "updated",
				});
			}
		} catch (error) {
			console.log("[PUSH] Existing record not found. Adding new record.");
		}

		try {
			const collection = $app.findCollectionByNameOrId("responsesGroup_1");
			const newRecord = new Record(collection);

			newRecord.set("responseId", responseId);
			newRecord.set("participantId", participantId);
			newRecord.set("responseType", responseType);
			newRecord.set("responseData", JSON.stringify(responseData));
			newRecord.set("assigned", false);

			$app.save(newRecord);

			console.log("[PUSH] New record created: " + newRecord.id);

			return requestContext.json(200, {
				id: newRecord.id,
				action: "created",
			});
		} catch (error) {
			console.log("[PUSH] Error creating new record: " + error.toString());
			throw new Error("[PUSH] Error creating new record. " + error.toString());
		}
	} catch (error) {
		logger(error);
		return requestContext.json(400, { error: error.toString() });
	}
});
