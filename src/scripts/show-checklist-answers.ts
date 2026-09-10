import 'dotenv/config';

import mongoose from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { OrderChecklist } from '../modules/orders/order-checklist.model.js';

const showChecklistAnswers = async (): Promise<void> => {
  await connectDatabase();

  const docs = await OrderChecklist.find({
    'answers.0': { $exists: true },
  })
    .sort({ updatedAt: -1 })
    .limit(3)
    .lean();

  if (docs.length === 0) {
    console.log('No order checklists with answers found. Run: npm run e2e:flow');
    return;
  }

  for (const doc of docs) {
    console.log('---');
    console.log(
      JSON.stringify(
        {
          orderId: doc.orderId,
          checklistName: doc.checklistName,
          templateVersion: doc.templateVersion,
          questionsSnapshot: doc.questionsSnapshot,
          answers: doc.answers,
          updatedAt: doc.updatedAt,
        },
        null,
        2,
      ),
    );
  }
};

void showChecklistAnswers()
  .then(async () => {
    await disconnectDatabase();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    try {
      await disconnectDatabase();
    } catch {
      // ignore
    }
    process.exit(1);
  });
