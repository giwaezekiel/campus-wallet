import mongoose, { Document, Schema } from "mongoose";

export interface IExpense extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  category: string;
  note: string;
  date: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true },
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

expenseSchema.index({ user: 1, date: -1 });

export const Expense = mongoose.model<IExpense>("Expense", expenseSchema);
