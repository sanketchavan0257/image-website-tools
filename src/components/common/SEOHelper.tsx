import { useEffect } from 'react';
import { ToolDefinition } from '../../types';

interface SEOHelperProps {
  currentPath: string;
  activeTool?: ToolDefinition;
}

export const SEOHelper: React.FC<SEOHelperProps> = ({
  currentPath,
  activeTool,
}) => {
  useEffect(() => {
    let title = 'PixiForge - Client-Side Image Tools Suite';
    let description =
      'Fast, 100% in-browser image tools: Resizer, Compressor, Cropper, Format Converters, Filters, and more with zero server uploads.';
    let canonical = window.location.origin + currentPath;

    if (activeTool) {
      title = `${activeTool.name} Online - Free & In-Browser | PixiForge`;
      description = activeTool.metaDescription || `${activeTool.description} Processed 100% in-browser on PixiForge.`;
    } else if (currentPath === '/pricing') {
      title = 'Plans & Pricing - PixiForge Image Tools';
      description =
        'Choose flexible Free, Pro, Max, or Ultra plans on PixiForge. Batch image resizing, background removal, and compression with zero upload limits.';
    } else if (currentPath === '/billing') {
      title = 'Billing & Invoices - PixiForge Image Tools';
      description =
        'View your active PixiForge subscription, billing duration, plan validity, and download verified Razorpay payment receipts.';
    } else if (currentPath === '/help') {
      title = 'Help & Support - PixiForge Image Tools';
      description =
        'Contact PixiForge support via Email or Mobile Number for help with plans, AutoPay renewals, refunds, or image tools.';
    } else if (currentPath === '/terms') {
      title = 'Terms & Conditions - PixiForge Image Tools';
      description =
        'Read the Terms & Conditions for using PixiForge client-side image tools and paid subscriptions.';
    } else if (currentPath === '/privacy-policy') {
      title = 'Privacy Policy - PixiForge Image Tools';
      description =
        'Learn how PixiForge protects your privacy with 100% browser-based image processing and zero server image storage.';
    } else if (currentPath === '/refund-policy') {
      title = 'Refund & Cancellation Policy - PixiForge Image Tools';
      description =
        'Cancel anytime with transparent pro-rata refunds credited to your account within 7–9 business days.';
    } else if (currentPath === '/shipping-policy') {
      title = 'Shipping / Delivery Policy - PixiForge Image Tools';
      description =
        'PixiForge provides instant digital activation of paid image editing plans with zero physical shipping.';
    } else if (currentPath === '/admin') {
      title = 'Admin Panel - PixiForge Membership & AutoPay';
      description =
        'Admin dashboard to manage user memberships, AutoPay mandates, full AutoPay refunds, and pro-rata cancellations.';
    } else if (currentPath === '/login' || currentPath === '/signup') {
      title = 'Account Login & Sign Up | PixiForge';
      description =
        'Access your PixiForge Pro image editing account and manage your unlimited batch processing tools.';
    } else if (currentPath === '/') {
      title = 'PixiForge - Client-Side Image Tools Suite';
      description =
        'Fast, 100% in-browser image tools: Resizer, Compressor, Cropper, Format Converters, Filters, and more with zero server uploads.';
      canonical = window.location.origin + '/';
    }

    // Set document title
    document.title = title;

    // Update or create standard meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Update OpenGraph title
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', title);
    }

    // Update OpenGraph description
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', description);
    }

    // Update OpenGraph URL
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', canonical);
    }

    // Update Twitter title & description
    let twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) {
      twTitle.setAttribute('content', title);
    }
    let twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) {
      twDesc.setAttribute('content', description);
    }

    // Update Canonical link
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    if (linkCanonical) {
      linkCanonical.setAttribute('href', canonical);
    }
  }, [currentPath, activeTool]);

  return null;
};
