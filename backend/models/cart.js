import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product", 
        required: true 
    },
    quantity: { 
        type: Number, 
        required: true, 
        min: 1 
    },
    variant: { 
        type: String 
    }, // optional (size/flavor/etc.)
    addedAt: { 
        type: Date, 
        default: Date.now 
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        unique: true, 
        index: true, 
        required: true 
    },
    items: { 
        type: [cartItemSchema], 
        default: [] 
    },
  },
  { timestamps: true }
);

export default mongoose.model("Cart", cartSchema);