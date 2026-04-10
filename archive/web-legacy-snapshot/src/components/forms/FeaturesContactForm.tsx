"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const FeaturesContactForm = () => {
  const [suggestion, setSuggestion] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (suggestion.trim() === "") {
      toast.error("Proszę opisać swoją sugestię");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      toast.success("Dziękujemy za Twoją sugestię!");
      setSuggestion("");
      setEmail("");
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-3xl rounded-lg bg-accent/30 p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold md:text-3xl">Brakuje czegoś ważnego?</h2>
        <p className="text-muted-foreground">
          Napisz do nas wiadomość. Monitorujemy sugestie z tej strony codziennie.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="suggestion" className="mb-1 block text-sm font-medium">
            Nad czym mamy pracować:
          </label>
          <textarea
            id="suggestion"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Opisz funkcję lub ulepszenie, którego potrzebujesz..."
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Skontaktuj się ze mną na ten email:
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="twoj@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <Button type="submit" className="px-8 py-2" disabled={isSubmitting}>
          {isSubmitting ? "Wysyłanie..." : "Wyślij"}
        </Button>

        <p className="mt-4 text-xs text-muted-foreground">
          Prosimy o jak najbardziej szczegółowy opis. Prawdziwi ludzie czytają Twoje sugestie.
        </p>
      </form>
    </div>
  );
};

export default FeaturesContactForm;
