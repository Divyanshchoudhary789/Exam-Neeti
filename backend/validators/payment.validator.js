const Joi = require("joi");
const { PLAN_KEYS } = require("../config/constants");

const createOrderSchema = Joi.object({
  planKey: Joi.string().valid(...Object.values(PLAN_KEYS)).required(),
});

const verifyPaymentSchema = Joi.object({
  razorpay_order_id:   Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature:  Joi.string().required(),
});

module.exports = { createOrderSchema, verifyPaymentSchema };
