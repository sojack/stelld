import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { formId, data, locale } = await req.json();

  const form = await prisma.form.findFirst({
    where: { id: formId, isPublished: true },
    include: {
      user: {
        include: { stripeConnect: true },
      },
    },
  });

  if (!form || !form.user.stripeConnect?.stripeAccountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Extract payment field from schema
  const schema = form.schema as {
    pages?: {
      elements?: Array<{
        type: string;
        paymentAmount?: number;
        paymentCurrency?: string;
        paymentDescription?: string;
      }>;
    }[];
  };
  const paymentField = schema?.pages?.[0]?.elements?.find(
    (el) => el.type === "expression" && el.paymentAmount
  );

  if (!paymentField?.paymentAmount) {
    return NextResponse.json({ error: "No payment field" }, { status: 400 });
  }

  const amountInCents = Math.round(paymentField.paymentAmount * 100);
  const currency = (paymentField.paymentCurrency ?? "CAD").toLowerCase();
  const platformFee = Math.round(amountInCents * 0.02); // 2% platform fee

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: paymentField.paymentDescription || form.title,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFee,
      },
      success_url: `${appUrl}/${locale || "en"}/f/${formId}?payment=success`,
      cancel_url: `${appUrl}/${locale || "en"}/f/${formId}?payment=canceled`,
      metadata: {
        formId,
        submissionData: JSON.stringify(data),
      },
    },
    {
      stripeAccount: form.user.stripeConnect.stripeAccountId,
    }
  );

  return NextResponse.json({ url: checkoutSession.url });
}
