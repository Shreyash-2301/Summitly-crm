import DealsDetailsComponent from "@/components/Pages/crm-module/deals/dealsDetails";

export const metadata = {
  title: "Deal Details | CRMS",
};

interface Props {
  params: Promise<{ key: string }>;
}

export default async function DealsDetailsPage({ params }: Props) {
  const { key } = await params;
  return <DealsDetailsComponent dealKey={key} />;
}
