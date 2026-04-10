// NOTE: This document is boilerplate. Have a lawyer review before relying on it.

import { Footer } from "@/components/footer";
import { Link } from "@/i18n/routing";

const EFFECTIVE_DATE = "April 9, 2026";
const EFFECTIVE_DATE_FR = "9 avril 2026";
const CONTACT_EMAIL = "info@jsdesigns.ca";

function TermsEN() {
  return (
    <article className="legal">
      <h1>Terms of Service</h1>
      <p className="text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of Stelld (&ldquo;the
        Service&rdquo;), a product owned and operated by JS Designs (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating an account or using the Service, you
        agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. Service Description</h2>
      <p>
        Stelld is a web-based form builder that allows you to create, publish, and collect
        responses to online forms. All data is stored on servers located in Canada.
      </p>

      <h2>2. Account Terms</h2>
      <ul>
        <li>You must be at least 18 years old to use the Service.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You must provide accurate and complete information when creating your account.</li>
        <li>
          You are responsible for all activity that occurs under your account.
        </li>
      </ul>

      <h2>3. Acceptable Use</h2>
      <p>You may not use the Service to:</p>
      <ul>
        <li>Collect personal information in violation of applicable law.</li>
        <li>Send unsolicited commercial messages (spam).</li>
        <li>Distribute malware or engage in phishing.</li>
        <li>Violate the rights of any third party.</li>
        <li>Engage in any activity that disrupts or interferes with the Service.</li>
      </ul>
      <p>
        We reserve the right to suspend or terminate accounts that violate these Terms without
        prior notice.
      </p>

      <h2>4. Paid Plans and Payments</h2>
      <p>
        Some features require a paid subscription. Payments are processed securely by Stripe.
        Subscriptions renew automatically at the end of each billing period until cancelled. You
        may cancel at any time through your billing settings; cancellation takes effect at the end
        of the current billing period. We do not offer refunds for partial periods.
      </p>

      <h2>5. Your Data</h2>
      <p>
        You retain full ownership of all data you collect through your forms, including respondent
        submissions. We do not sell your data or your respondents&rsquo; data to third parties.
        All data is stored in AWS ca&#8209;central&#8209;1 (Canada). Please review our{" "}
        <Link href="/privacy">Privacy Policy</Link> for full details.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        The Service and its original content, features, and functionality are and will remain the
        exclusive property of JS Designs. You may not copy, modify, or distribute any part of the
        Service without our express written permission.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, JS Designs shall not be liable for any
        indirect, incidental, special, consequential, or punitive damages arising from your use of
        or inability to use the Service, even if we have been advised of the possibility of such
        damages.
      </p>

      <h2>8. Disclaimer of Warranties</h2>
      <p>
        The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis
        without warranties of any kind, either express or implied.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may delete your account at any time. We may suspend or terminate your account if you
        violate these Terms. Upon termination, your right to use the Service ceases immediately.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of material changes by
        email or by displaying a notice in the Service. Continued use of the Service after changes
        constitutes acceptance of the updated Terms.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the Province of Ontario and the federal laws of
        Canada applicable therein, without regard to conflict of law principles.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms may be directed to JS Designs at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  );
}

function TermsFR() {
  return (
    <article className="legal">
      <h1>Conditions d&rsquo;utilisation</h1>
      <p className="text-sm text-gray-500">Date d&rsquo;entrée en vigueur : {EFFECTIVE_DATE_FR}</p>

      <p>
        Les présentes Conditions d&rsquo;utilisation (&laquo;&nbsp;Conditions&nbsp;&raquo;)
        régissent votre utilisation de Stelld (&laquo;&nbsp;le Service&nbsp;&raquo;), un produit
        détenu et exploité par JS Designs (&laquo;&nbsp;nous&nbsp;&raquo;). En créant un compte ou
        en utilisant le Service, vous acceptez ces Conditions. Si vous n&rsquo;acceptez pas,
        n&rsquo;utilisez pas le Service.
      </p>

      <h2>1. Description du Service</h2>
      <p>
        Stelld est un créateur de formulaires en ligne qui vous permet de créer, publier et
        collecter des réponses à des formulaires web. Toutes les données sont stockées sur des
        serveurs situés au Canada.
      </p>

      <h2>2. Conditions de compte</h2>
      <ul>
        <li>Vous devez avoir au moins 18 ans pour utiliser le Service.</li>
        <li>Vous êtes responsable de la sécurité de vos identifiants de connexion.</li>
        <li>Vous devez fournir des informations exactes et complètes lors de la création de votre compte.</li>
        <li>Vous êtes responsable de toute activité effectuée sous votre compte.</li>
      </ul>

      <h2>3. Utilisation acceptable</h2>
      <p>Vous ne pouvez pas utiliser le Service pour :</p>
      <ul>
        <li>Collecter des renseignements personnels en violation de la loi applicable.</li>
        <li>Envoyer des messages commerciaux non sollicités (pourriels).</li>
        <li>Distribuer des logiciels malveillants ou mener des activités d&rsquo;hameçonnage.</li>
        <li>Violer les droits de tiers.</li>
        <li>Perturber ou interférer avec le bon fonctionnement du Service.</li>
      </ul>
      <p>
        Nous nous réservons le droit de suspendre ou de résilier les comptes qui contreviennent à
        ces Conditions, sans préavis.
      </p>

      <h2>4. Forfaits payants et paiements</h2>
      <p>
        Certaines fonctionnalités nécessitent un abonnement payant. Les paiements sont traités de
        manière sécurisée par Stripe. Les abonnements se renouvellent automatiquement à la fin de
        chaque période de facturation jusqu&rsquo;à leur résiliation. Vous pouvez annuler à tout
        moment dans vos paramètres de facturation ; l&rsquo;annulation prend effet à la fin de la
        période en cours. Nous n&rsquo;offrons pas de remboursements pour les périodes partielles.
      </p>

      <h2>5. Vos données</h2>
      <p>
        Vous conservez la pleine propriété de toutes les données collectées via vos formulaires,
        y compris les réponses des utilisateurs. Nous ne vendons pas vos données ni celles de vos
        répondants à des tiers. Toutes les données sont stockées dans AWS ca&#8209;central&#8209;1
        (Canada). Consultez notre{" "}
        <Link href="/privacy">Politique de confidentialité</Link> pour plus de détails.
      </p>

      <h2>6. Propriété intellectuelle</h2>
      <p>
        Le Service et son contenu original sont et demeureront la propriété exclusive de JS
        Designs. Vous ne pouvez pas copier, modifier ou distribuer toute partie du Service sans
        notre autorisation écrite expresse.
      </p>

      <h2>7. Limitation de responsabilité</h2>
      <p>
        Dans toute la mesure permise par la loi applicable, JS Designs ne sera pas responsable
        des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs découlant de votre
        utilisation du Service ou de votre incapacité à l&rsquo;utiliser.
      </p>

      <h2>8. Exclusion de garanties</h2>
      <p>
        Le Service est fourni &laquo;&nbsp;tel quel&nbsp;&raquo; et &laquo;&nbsp;selon
        disponibilité&nbsp;&raquo;, sans garantie d&rsquo;aucune sorte, expresse ou implicite.
      </p>

      <h2>9. Résiliation</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment. Nous pouvons suspendre ou résilier
        votre compte si vous violez ces Conditions. À la résiliation, votre droit d&rsquo;utiliser
        le Service cesse immédiatement.
      </p>

      <h2>10. Modifications des Conditions</h2>
      <p>
        Nous pouvons mettre à jour ces Conditions de temps à autre. Nous vous informerons des
        changements importants par courriel ou via une notice dans le Service. La poursuite de
        l&rsquo;utilisation du Service après les modifications vaut acceptation des Conditions
        mises à jour.
      </p>

      <h2>11. Droit applicable</h2>
      <p>
        Ces Conditions sont régies par les lois de la province d&rsquo;Ontario et les lois
        fédérales du Canada qui y sont applicables.
      </p>

      <h2>12. Contact</h2>
      <p>
        Toute question concernant ces Conditions peut être adressée à JS Designs à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  );
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {locale === "fr" ? <TermsFR /> : <TermsEN />}
      </div>
      <Footer />
    </div>
  );
}
