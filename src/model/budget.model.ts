import mongoose, { Document, Schema } from "mongoose";

export interface IBudget extends Document {
  user: mongoose.Types.ObjectId;
  category: string;
  limit: number;
  spent: number;
  month: string; // "YYYY-MM"
  alertSent: boolean;
}

const budgetSchema = new Schema<IBudget>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    limit: { type: Number, required: true, min: 1 },
    spent: { type: Number, default: 0 },
    month: { type: String, required: true },
    alertSent: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

budgetSchema.index({ user: 1, category: 1, month: 1 }, { unique: true });

export const Budget = mongoose.model<IBudget>("Budget", budgetSchema);
