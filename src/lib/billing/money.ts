import Decimal from "decimal.js";
import type { Model } from "../db/schema";
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export const money = (value: Decimal.Value) => new Decimal(value).toFixed(8);
export function prices(model: Model) {
  const multiplier = new Decimal(1).plus(
    new Decimal(model.markupPercentage).div(100),
  );
  return model.pricingMode === "MANUAL_CUSTOMER_PRICE"
    ? {
        input: model.customerInputPricePerMillion,
        output: model.customerOutputPricePerMillion,
      }
    : {
        input: money(
          new Decimal(model.upstreamInputPricePerMillion).mul(multiplier),
        ),
        output: money(
          new Decimal(model.upstreamOutputPricePerMillion).mul(multiplier),
        ),
      };
}
export function cost(
  input: number,
  output: number,
  inputPrice: string,
  outputPrice: string,
) {
  return money(
    new Decimal(input)
      .mul(inputPrice)
      .plus(new Decimal(output).mul(outputPrice))
      .div(1_000_000),
  );
}
export function remaining(key: {
  allocatedCredit: string;
  creditUsed: string;
  creditReserved: string;
}) {
  return money(
    new Decimal(key.allocatedCredit)
      .minus(key.creditUsed)
      .minus(key.creditReserved),
  );
}
export { Decimal };
