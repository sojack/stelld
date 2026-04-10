// NOTE: This document is boilerplate. Have a lawyer review before relying on it.

import { Footer } from "@/components/footer";
import { Link } from "@/i18n/routing";

const EFFECTIVE_DATE = "April 9, 2026";
const EFFECTIVE_DATE_FR = "9 avril 2026";
const CONTACT_EMAIL = "info@jsdesigns.ca";

function PrivacyEN() {
  return (
    <article className="legal">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>

      <p>
        This Privacy Policy describes how JS Designs (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
        &ldquo;our&rdquo;) collects, uses, and protects information through Stelld (&ldquo;the
        Service&rdquo;), in compliance with Canada&rsquo;s <em>Personal Information Protection
        and Electronic Documents Act</em> (PIPEDA).
      </p>

      <h2>1. Information We Collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address, and password (stored as
          a secure hash) when you register.
        </li>
        <li>
          <strong>Form data:</strong> the forms you create, their settings, and the responses
          submitted to them by your respondents.
        </li>
        <li>
          <strong>Billing information:</strong> if you subscribe to a paid plan, Stripe collects
          and processes your payment details. We store only the Stripe customer ID and
          subscription status — we never store full card numbers.
        </li>
        <li>
          <strong>Usage data:</strong> basic server logs (IP address, request timestamps) for
          security monitoring and debugging purposes.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide, operate, and improve the Service.</li>
        <li>
          To send transactional emails — submission notifications and password resets — via our
          email provider (Resend).
        </li>
        <li>To process payments via Stripe for paid subscriptions.</li>
        <li>To respond to support requests and inquiries.</li>
        <li>To detect, investigate, and prevent fraudulent or unauthorized use.</li>
      </ul>
      <p>We do not sell your personal information or your respondents&rsquo; data to any third party.</p>

      <h2>3. Data Residency</h2>
      <p>
        All form data and account information is stored on Amazon Web Services (AWS)
        infrastructure in the <strong>ca&#8209;central&#8209;1 region (Canada)</strong>. Your
        data does not leave Canada.
      </p>

      <h2>4. Third-Party Services</h2>
      <p>We use the following third-party services to operate Stelld:</p>
      <ul>
        <li>
          <strong>Stripe</strong> — payment processing. Stripe is PCI-DSS compliant. See{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
            Stripe&rsquo;s Privacy Policy
          </a>.
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery. Emails contain no personal
          data beyond your email address.
        </li>
        <li>
          <strong>Amazon Web Services</strong> — cloud hosting and storage, located in Canada.
        </li>
      </ul>

      <h2>5. Cookies</h2>
      <p>
        We use a single session cookie to keep you logged in. We do not use tracking or
        advertising cookies.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain your account information and form data for as long as your account is active.
        Server logs are retained for up to 90 days. You may request deletion of your account and
        associated data by contacting us.
      </p>

      <h2>7. Your Rights (PIPEDA)</h2>
      <p>Under PIPEDA, you have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Request correction of inaccurate information.</li>
        <li>Withdraw consent to collection or use of your personal information (which may
          require closing your account).</li>
        <li>Lodge a complaint with the Office of the Privacy Commissioner of Canada.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>8. Security</h2>
      <p>
        We use industry-standard measures to protect your data, including encrypted connections
        (TLS 1.2+), hashed passwords (bcrypt), and access controls on our infrastructure. No
        method of transmission or storage is 100% secure; we cannot guarantee absolute security.
      </p>

      <h2>9. Children&rsquo;s Privacy</h2>
      <p>
        The Service is not directed at individuals under 18. We do not knowingly collect personal
        information from minors.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material
        changes by email. Continued use of the Service after changes constitutes acceptance of
        the updated Policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy inquiries may be directed to JS Designs at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p className="text-sm text-gray-500">
        For our full Terms of Service, see our <Link href="/terms">Terms of Service</Link> page.
      </p>
    </article>
  );
}

function PrivacyFR() {
  return (
    <article className="legal">
      <h1>Politique de confidentialité</h1>
      <p className="text-sm text-gray-500">Date d&rsquo;entrée en vigueur : {EFFECTIVE_DATE_FR}</p>

      <p>
        La présente Politique de confidentialité décrit la façon dont JS Designs
        (&laquo;&nbsp;nous&nbsp;&raquo;) collecte, utilise et protège les informations dans le
        cadre de Stelld (&laquo;&nbsp;le Service&nbsp;&raquo;), conformément à la{" "}
        <em>Loi sur la protection des renseignements personnels et les documents électroniques</em>{" "}
        (LPRPDE) du Canada.
      </p>

      <h2>1. Informations que nous collectons</h2>
      <ul>
        <li>
          <strong>Informations de compte :</strong> votre nom, adresse courriel et mot de passe
          (stocké sous forme de hachage sécurisé) lors de votre inscription.
        </li>
        <li>
          <strong>Données de formulaire :</strong> les formulaires que vous créez, leurs
          paramètres et les réponses soumises par vos répondants.
        </li>
        <li>
          <strong>Informations de facturation :</strong> si vous souscrivez à un forfait payant,
          Stripe collecte et traite vos informations de paiement. Nous ne stockons que
          l&rsquo;identifiant client Stripe et le statut de l&rsquo;abonnement — nous ne
          stockons jamais les numéros de carte complets.
        </li>
        <li>
          <strong>Données d&rsquo;utilisation :</strong> journaux serveur de base (adresse IP,
          horodatage des requêtes) à des fins de sécurité et de débogage.
        </li>
      </ul>

      <h2>2. Comment nous utilisons vos informations</h2>
      <ul>
        <li>Pour fournir, exploiter et améliorer le Service.</li>
        <li>
          Pour envoyer des courriels transactionnels — notifications de soumissions et
          réinitialisations de mot de passe — via notre fournisseur de courriel (Resend).
        </li>
        <li>Pour traiter les paiements via Stripe pour les abonnements payants.</li>
        <li>Pour répondre aux demandes d&rsquo;assistance.</li>
        <li>Pour détecter et prévenir les utilisations frauduleuses ou non autorisées.</li>
      </ul>
      <p>
        Nous ne vendons pas vos renseignements personnels ni les données de vos répondants à des
        tiers.
      </p>

      <h2>3. Résidence des données</h2>
      <p>
        Toutes les données de formulaire et informations de compte sont stockées sur
        l&rsquo;infrastructure Amazon Web Services (AWS) dans la{" "}
        <strong>région ca&#8209;central&#8209;1 (Canada)</strong>. Vos données ne quittent pas
        le Canada.
      </p>

      <h2>4. Services tiers</h2>
      <p>Nous utilisons les services tiers suivants pour exploiter Stelld :</p>
      <ul>
        <li>
          <strong>Stripe</strong> — traitement des paiements. Stripe est conforme à la norme
          PCI-DSS. Consultez la{" "}
          <a href="https://stripe.com/fr-ca/privacy" target="_blank" rel="noopener noreferrer">
            politique de confidentialité de Stripe
          </a>.
        </li>
        <li>
          <strong>Resend</strong> — envoi de courriels transactionnels. Les courriels ne
          contiennent aucune donnée personnelle autre que votre adresse courriel.
        </li>
        <li>
          <strong>Amazon Web Services</strong> — hébergement et stockage en nuage, situés au
          Canada.
        </li>
      </ul>

      <h2>5. Témoins (cookies)</h2>
      <p>
        Nous utilisons un seul témoin de session pour vous maintenir connecté. Nous
        n&rsquo;utilisons pas de témoins de suivi ou publicitaires.
      </p>

      <h2>6. Conservation des données</h2>
      <p>
        Nous conservons vos informations de compte et données de formulaire aussi longtemps que
        votre compte est actif. Les journaux serveur sont conservés jusqu&rsquo;à 90 jours. Vous
        pouvez demander la suppression de votre compte et des données associées en nous
        contactant.
      </p>

      <h2>7. Vos droits (LPRPDE)</h2>
      <p>Conformément à la LPRPDE, vous avez le droit de :</p>
      <ul>
        <li>Accéder aux renseignements personnels que nous détenons à votre sujet.</li>
        <li>Demander la correction d&rsquo;informations inexactes.</li>
        <li>
          Retirer votre consentement à la collecte ou à l&rsquo;utilisation de vos
          renseignements personnels (ce qui peut nécessiter la fermeture de votre compte).
        </li>
        <li>
          Déposer une plainte auprès du Commissariat à la protection de la vie privée du Canada.
        </li>
      </ul>
      <p>
        Pour exercer l&rsquo;un de ces droits, contactez-nous à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Nous utilisons des mesures conformes aux normes de l&rsquo;industrie pour protéger vos
        données, notamment des connexions chiffrées (TLS 1.2+), des mots de passe hachés
        (bcrypt) et des contrôles d&rsquo;accès à notre infrastructure. Aucune méthode de
        transmission ou de stockage n&rsquo;est totalement sécurisée ; nous ne pouvons pas
        garantir une sécurité absolue.
      </p>

      <h2>9. Protection des mineurs</h2>
      <p>
        Le Service n&rsquo;est pas destiné aux personnes de moins de 18 ans. Nous ne collectons
        pas sciemment de renseignements personnels auprès de mineurs.
      </p>

      <h2>10. Modifications de cette Politique</h2>
      <p>
        Nous pouvons mettre à jour cette Politique de confidentialité de temps à autre. Nous vous
        informerons des changements importants par courriel. La poursuite de l&rsquo;utilisation
        du Service après les modifications vaut acceptation de la Politique mise à jour.
      </p>

      <h2>11. Contact</h2>
      <p>
        Toute question relative à la confidentialité peut être adressée à JS Designs à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <p className="text-sm text-gray-500">
        Pour nos Conditions d&rsquo;utilisation complètes, consultez notre page{" "}
        <Link href="/terms">Conditions d&rsquo;utilisation</Link>.
      </p>
    </article>
  );
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {locale === "fr" ? <PrivacyFR /> : <PrivacyEN />}
      </div>
      <Footer />
    </div>
  );
}
