"use strict";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { products, userName, email, userId } = ctx.request.body;
    console.log('Received userId:', userId); // Add this line

    try {
      // retrieve item information
      const lineItems = await Promise.all(
        products.map(async (product) => {
          const item = await strapi.services.item.findOne(product.id);

          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: item.name,
              },
              unit_amount: item.price * 100,
            },
            quantity: product.count,
          };
        })
      );

      // create a stripe session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: email,
        mode: "payment",
        success_url: "https://jj-react-ecommerce.vercel.app/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://jj-react-ecommerce.vercel.app",
        line_items: lineItems,
      });

      // Find the user instance
      const user = await strapi.plugins['users-permissions'].services.user.fetch({ id: userId });

      // create the order
      await strapi.services.order.create({
        userName,
        products,
        stripeSessionId: session.id,
        user
      });

      // return the session id
      ctx.send({ id: session.id });
    } catch (error) {
      ctx.response.status = 500;
      ctx.send({ error: { message: "There was a problem creating the charge" } });
    }
  },
}));
