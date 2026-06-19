import mongoose, { Document, Schema } from "mongoose";

export interface IWallet extends Document {
  user: mongoose.Types.ObjectId;
  balance: number;
}

export interface IWalletTransaction extends Document {
  user: mongoose.Types.ObjectId;
  type: "credit" | "debit";
  amount: number;
  description: string;
  reference?: string;
  date: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const walletTransactionSchema = new Schema<IWalletTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    reference: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

walletTransactionSchema.index({ user: 1, date: -1 });

export const Wallet = mongoose.model<IWallet>("Wallet", walletSchema);
export const WalletTransaction = mongoose.model<IWalletTransaction>(
  "WalletTransaction",
  walletTransactionSchema
);
