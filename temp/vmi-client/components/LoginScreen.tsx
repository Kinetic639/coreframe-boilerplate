'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { KeyRound, Lock, Mail, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { UserProfile } from '../lib/types';

interface LoginScreenProps {
  preFilledUser: UserProfile;
  onLoginSuccess: (profile: UserProfile) => void;
  onBackToMarketplace?: () => void;
}

export default function LoginScreen({ preFilledUser, onLoginSuccess, onBackToMarketplace }: LoginScreenProps) {
  const [email, setEmail] = useState('m.stepien@autoservice-komorniki.pl');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess(preFilledUser);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F8F9FA] dark:bg-[#0A0D16] text-[#1A1C1E] dark:text-white overflow-hidden relative">
      {onBackToMarketplace && (
        <button
          onClick={onBackToMarketplace}
          className="absolute top-6 left-6 py-2 px-4 bg-white dark:bg-[#0E1321] hover:bg-gray-50 dark:hover:bg-gray-850 text-[#2A3B4C] dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all z-20"
        >
          ← Powrót do giełdy
        </button>
      )}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Identity */}
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-16 h-16 bg-[#2A3B4C] dark:bg-blue-600 rounded-2xl flex items-center justify-center shadow-md"
          >
            <span className="text-3xl font-extrabold tracking-wider text-white font-display">A</span>
          </motion.div>
          <motion.h2
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mt-6 text-center text-3xl font-bold font-display tracking-tight text-[#2A3B4C] dark:text-blue-400"
          >
            Ambra VMI Client
          </motion.h2>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400"
          >
            Dedykowany portal klienta VMI • Platforma B2B Ambra
          </motion.p>
        </div>
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-white dark:bg-[#0E1321] py-8 px-6 shadow-sm rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                E-mail służbowy
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-[#0C101A] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2A3B4C] dark:focus:ring-blue-500 focus:border-[#2A3B4C] dark:focus:border-blue-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  placeholder="nazwa@firma.pl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                Hasło dostępu
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-white dark:bg-[#0C101A] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2A3B4C] dark:focus:ring-blue-500 focus:border-[#2A3B4C] dark:focus:border-blue-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                  placeholder="Wpisz hasło"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-[#2A3B4C] dark:text-blue-500 focus:ring-[#2A3B4C] dark:focus:ring-blue-500 bg-white dark:bg-gray-850 rounded transition-colors cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                  Zapamiętaj mnie
                </label>
              </div>

              <div className="text-sm">
                <a href="#" onClick={(e) => { e.preventDefault(); setError('Funkcja odzyskiwania hasła została wyłączona w wersji demo. Skontaktuj się ze swoim administratorem Ambra.'); }} className="font-medium text-[#2A3B4C] dark:text-blue-400 hover:underline transition-colors">
                  Zapomniałeś hasła?
                </a>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-50 dark:bg-red-950/10 rounded-xl p-3 text-xs text-red-600 dark:text-red-400 flex items-start gap-2"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 rounded-xl shadow-sm text-sm font-medium text-white bg-[#2A3B4C] hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2A3B4C] dark:focus:ring-blue-500 focus:ring-offset-gray-50 transition-all transform active:scale-95 cursor-pointer"
              >
                Zaloguj się
              </button>
            </div>
          </form>

          {/* Demo info card */}
          <div className="mt-8 pt-6">
            <div className="bg-[#F0F2F5] dark:bg-[#0C101A] rounded-xl p-4">
              <div className="flex gap-3">
                <UserCheck className="h-5 w-5 text-[#2A3B4C] dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-semibold text-[#2A3B4C] dark:text-blue-400">Profil demonstracyjny aktywnego klienta</h4>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Aplikacja jest wstępnie skonfigurowana dla konta:
                  </p>
                  <div className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-300 space-y-0.5 bg-white dark:bg-gray-900 p-2 rounded-lg">
                    <div><span className="text-gray-400 dark:text-gray-500">Użytkownik:</span> Michał Stępień</div>
                    <div><span className="text-gray-400 dark:text-gray-500">Rola:</span> Kierownik Oddziału (Branch Manager)</div>
                    <div><span className="text-gray-400 dark:text-gray-500">Firma:</span> AutoService Komorniki</div>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                    Kliknięcie przycisku „Zaloguj się” natychmiast zaloguje do interaktywnego panelu klienta.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Sparkles className="h-3.5 w-3.5 text-[#2A3B4C] dark:text-blue-400" />
          <span>W pełni interaktywna makieta w języku polskim</span>
        </div>
      </motion.div>
    </div>
  );
}
