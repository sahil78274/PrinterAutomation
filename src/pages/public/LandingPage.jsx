import PublicHeader from '../../components/layout/PublicHeader.jsx';
import PublicFooter from '../../components/layout/PublicFooter.jsx';
import Hero from '../../components/marketing/Hero.jsx';
import HowItWorks from '../../components/marketing/HowItWorks.jsx';
import Features from '../../components/marketing/Features.jsx';
import ForShopOwners from '../../components/marketing/ForShopOwners.jsx';
import Pricing from '../../components/marketing/Pricing.jsx';
import Faq from '../../components/marketing/Faq.jsx';
import CtaSection from '../../components/marketing/CtaSection.jsx';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ForShopOwners />
        <Pricing />
        <Faq />
        <CtaSection />
      </main>
      <PublicFooter />
    </div>
  );
}
