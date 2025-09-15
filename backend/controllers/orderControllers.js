import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import ErrorHandler from "../utils/errorHandler.js";
import Cart from "../models/cart.js";
import { calculateOrderCost } from "../utils/orderCost.js";

// Create new Order => /api/v1/orders/new
export const newOrder = catchAsyncErrors(async (req, res, next) => {
  const { shippingInfo, paymentMethod, paymentInfo } = req.body; // keep only non-money fields

  // 1) Load server-side cart
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({ path: "items.product", select: "name price stock images" });

  if (!cart || cart.items.length === 0) {
    return next(new ErrorHandler("Your cart is empty", 400));
  }

  // 2) Normalize items from cart + clamp by stock
  const orderItems = cart.items
    .filter(ci => (ci.product?.stock ?? 0) > 0)
    .map(ci => ({
      product: ci.product._id,
      name: ci.product.name,
      price: ci.product.price,
      image: ci.product.images?.[0]?.url,
      quantity: Math.min(ci.quantity, ci.product.stock ?? 0),
      variant: ci.variant,
    }));

  if (orderItems.length === 0) {
    return next(new ErrorHandler("All items are out of stock", 400));
  }

  // 3) Compute money on the server (trusted)
  const { itemsPrice, shippingPrice: shippingAmount, taxPrice: taxAmount, totalPrice: totalAmount } =
    calculateOrderCost(orderItems);

  // 4) Create order with server-computed amounts
  const order = await Order.create({
    user: req.user._id,
    orderItems,
    shippingInfo,
    itemsPrice,
    taxAmount,
    shippingAmount,
    totalAmount,
    paymentMethod,
    paymentInfo,
  });

  // 6) Clear server cart
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });

  res.status(200).json({ order });
});


// Get current user orders => /api/v1/me/orders/ 
export const myOrders = catchAsyncErrors(async ( req,res,next) => {
    //get user's name and email specifically and order
    const orders = await Order.find({ user: req.user._id});

    res.status(200).json({
        orders,
    });
});

// Get Order details => /api/v1/orders/:id  
export const getOrderDetails = catchAsyncErrors(async ( req,res,next) => {
    const order = await Order.findById(req.params.id).populate("user", "name email");

    if(!order){
        return next(new ErrorHandler("No Order found with this Id", 404));
    }

    res.status(200).json({
        order,
    });
});


// Get All Ordes - ADMIN => /api/v1/admin/orders
export const allOrders = catchAsyncErrors(async ( req,res,next) => {
    const orders = await Order.find();

    res.status(200).json({
        orders,
    });
});



// Update Ordes - ADMIN => /api/v1/admin/orders/:id
export const updateOrder = catchAsyncErrors(async ( req,res,next) => {
    const order = await Order.findById(req.params.id);

    if(!order){
        return next(new ErrorHandler("No Order found with this Id", 404));
    }

    if(order?.orderStatus === "Delivered"){
        return next(new ErrorHandler("You have already delivered this order", 400));
    }

    let productNotFound = false

    // Update products stock
    for (const item of order.orderItems) {
        const product = await Product.findById(item?.product?.toString());
        if (!product) {
            productNotFound = true;
            break;
        }
        product.stock = product.stock - item.quantity;
        await product.save({ validateBeforeSave: false });
    }

    if (productNotFound) {
        return next(
            new ErrorHandler("No Product found with one or more IDs.", 404)
            );
    }

    order.orderStatus = req.body.status;
    order.deliveredAt = Date.now();

    await order.save();

    res.status(200).json({
        success: true,
    });
});



// Delete Order => /api/v1/admin/orders/:id  
export const deleteOrder = catchAsyncErrors(async ( req,res,next) => {
    const order = await Order.findById(req.params.id);

    if(!order){
        return next(new ErrorHandler("No Order found with this Id", 404));
    }

    await order.deleteOne();

    res.status(200).json({
        success:true,
    });
});

async function getSalesDate(startDate, endDate){
    const salesData = await Order.aggregate([
        {
            // Stage 1 - Filter results
            $match: {
                createdAt:{
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                },
            },
        },
        {
            // Stage 2 - Group Data
            $group: {
                _id:{
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                },
                totalSales: { $sum: "$totalAmount" },
                numOrders: { $sum: 1 } // count the number of orders
            },
        },
    ]);

    // Create a Map to store sales data and num of order by data
    const salesMap = new Map();
    let totalSales = 0;
    let totalNumOrders = 0;

    salesData.forEach((entry) => {
        const date = entry?._id.date;
        const sales = entry?.totalSales;
        const numOrders = entry?.numOrders;

        salesMap.set(date, { sales, numOrders});
        totalSales += sales;
        totalNumOrders += numOrders;
    });

    // Generate an array of dates between start & end date
    const datesBetween = getDatesBetween(startDate, endDate);

    // Create final sales date array with 0 for dates without sales
    const finalSalesData = datesBetween.map((date) => ({
        date,
        sales: (salesMap.get(date) || {sales : 0}).sales,
        numOrders: (salesMap.get(date) || {numOrders : 0}).numOrders,
    }));

    return { salesData: finalSalesData, totalSales, totalNumOrders};
    
}

   
function getDatesBetween(startDate, endDate) {
    const dates=[];
    let currentDate = new Date(startDate)

    while(currentDate <= new Date(endDate)) {
        const formattedDate = currentDate.toISOString().split("T")[0];
        dates.push(formattedDate);
        currentDate.setDate(currentDate.getDate()+1);
    }

    return dates;
}


// Get Sales Data => /api/v1/admin/get_sales  
export const getSales = catchAsyncErrors(async ( req,res,next) => {
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);

    startDate.setUTCHours(0,0,0,0);
    endDate.setUTCHours(23,59,59,999);

    const { salesData, totalSales, totalNumOrders } = await getSalesDate(startDate,endDate);

    res.status(200).json({
        totalSales, 
        totalNumOrders,
        sales: salesData,
    });
});
