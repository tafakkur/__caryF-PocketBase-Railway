/// <reference path="../data/types.d.ts" />

console.log("[RESET] Loaded reset.pb.js");

routerAdd("GET", "/api/group2/reset", (requestContext) => {
	const logger = function (error) {
		console.log(`[RESET] [LOGGER] Error processing ${requestContext.request.method} ${requestContext.request.url.path}: ${error}`);
		try {
			const collection = $app.findCollectionByNameOrId("errors");
			const record = new Record(collection);

			const payload = {
				error: error.toString(),
				context: `${requestContext.request.method} ${requestContext.request.url.path}`,
				timestamp: new Date().toISOString(),
			};

			record.set("errorDetails", JSON.stringify(payload));
			$app.save(record);
		} catch (loggingError) {
			console.log("[RESET] [LOGGER] Log Failed: " + loggingError.toString());
		}
	};
	try {
		const allAssigned = $app.findRecordsByFilter("responsesGroup_1", "assigned = true");
		allAssigned.forEach((record) => {
			record.set("assigned", false);
			record.set("assignedTo", "");
			record.set("assignedToParticipantId", "");
			record.set("flagGroup2", false);
			$app.save(record);
		});

		console.log(`[RESET] Reset ${allAssigned.length} records in responsesGroup_1`);
		return requestContext.json(200, {
			statusCode: 200,
			message: `Cleared assignment for ${allAssigned.length} records in responsesGroup_1`,
		});
	} catch (e) {
		logger(e);
		return requestContext.json(400, {
			statusCode: 400,
			message: `Encountered error: ${e.toString()}`,
		});
	}
});
