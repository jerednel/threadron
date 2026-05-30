const engineers = document.querySelector("#engineers");
const hours = document.querySelector("#hours");
const rate = document.querySelector("#rate");
const result = document.querySelector("#result");

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function updateResult() {
  const monthlyCost = Number(engineers.value) * Number(hours.value) * Number(rate.value) * 4;
  result.value = `${formatCurrency(monthlyCost)}/month in recoverable coordination cost`;
}

[engineers, hours, rate].forEach((input) => input.addEventListener("input", updateResult));
updateResult();
