import mongoose, { Document, Schema } from 'mongoose';

export interface IApiRequest extends Document {
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  status: number;
  responseTime: number;
  timestamp: Date;
  userAgent: string;
  ipAddress: string;
}

const apiRequestSchema = new Schema<IApiRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    endpoint: {
      type: String,
      required: true
    },
    status: {
      type: Number,
      required: true
    },
    responseTime: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    userAgent: {
      type: String,
      required: true
    },
    ipAddress: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying of user requests
apiRequestSchema.index({ userId: 1, timestamp: -1 });

const ApiRequest = mongoose.model<IApiRequest>('ApiRequest', apiRequestSchema);

export default ApiRequest; 