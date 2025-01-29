/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  Currency,
  CurrencyFormatter,
  ensureIsArray,
  getNumberFormatter,
  isSavedMetric,
  QueryFormMetric,
  ValueFormatter,
  NumberFormatter,
} from '@superset-ui/core';
import localeCurrency from 'locale-currency';

const getCurrencyForLocale = (locale: string): string =>
  localeCurrency.getCurrency(locale) || 'USD'; // fallback to USD if not found

export const buildCustomFormatters = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  savedCurrencyFormats: Record<string, Currency>,
  savedColumnFormats: Record<string, string>,
  d3Format: string | undefined,
  currencyFormat: Currency | undefined,
) => {
  const metricsArray = ensureIsArray(metrics);
  return metricsArray.reduce((acc, metric) => {
    if (isSavedMetric(metric)) {
      const actualD3Format = d3Format ?? savedColumnFormats[metric];
      const actualCurrencyFormat = currencyFormat?.symbol
        ? currencyFormat
        : savedCurrencyFormats[metric];

      return {
        ...acc,
        [metric]: actualCurrencyFormat
          ? new CurrencyFormatter({
              d3Format: actualD3Format,
              currency: actualCurrencyFormat,
            })
          : getNumberFormatter(actualD3Format),
      };
    }
    return acc;
  }, {});
};

export const getCustomFormatter = (
  customFormatters: Record<string, ValueFormatter>,
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  key?: string,
) => {
  const metricsArray = ensureIsArray(metrics);
  if (metricsArray.length === 1 && isSavedMetric(metricsArray[0])) {
    return customFormatters[metricsArray[0]];
  }
  return key ? customFormatters[key] : undefined;
};

export const getValueFormatter = (
  metrics: QueryFormMetric | QueryFormMetric[] | undefined,
  savedCurrencyFormats: Record<string, Currency>,
  savedColumnFormats: Record<string, string>,
  d3Format: string | undefined,
  currencyFormat: Currency | undefined,
  key?: string,
): ValueFormatter => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlLocale = urlParams.get('locale'); // Récupérer locale depuis URL
  const currencySymbol = urlParams.get('currencySymbol'); // Récupérer symbol depuis URL

  // ✅ Vérifier si on est en embedding (si locale ou currencySymbol sont spécifiés)
  const isEmbedding = !!(urlLocale || currencySymbol);

  // ✅ Cas Superset standard sans embedding → Pas de symbole
  if (!isEmbedding) {
    console.log('Pas d’URL params - Superset standard, affichage par défaut.');
    if (currencyFormat?.symbol) {
      return new CurrencyFormatter({ currency: currencyFormat, d3Format });
    }
    return getNumberFormatter(d3Format);
  }

  try {
    // ✅ Définir locale et devise
    const locale = urlLocale || 'en-US'; // Fallback à 'en-US'
    const currencyCode = getCurrencyForLocale(locale);
    const finalSymbol = currencySymbol || currencyCode; // Si currencySymbol est défini, il prime

    // ✅ Appliquer le format numérique
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return new NumberFormatter({
      id: `currency-${currencyCode}`,
      formatFunc: (value: number) => {
        let formattedValue = formatter.format(value);

        // ✅ Remplacer le symbole uniquement si un `currencySymbol` est défini
        if (currencySymbol) {
          formattedValue = formattedValue.replace(/\p{Sc}|\b[A-Z]{3}\b/gu, currencySymbol);
        }

        return formattedValue;
      },
      label: isEmbedding ? `Currency (${finalSymbol})` : '',
      description: isEmbedding
        ? `Formats numbers as currency in ${finalSymbol}`
        : '',
    });
  } catch (error) {
    console.error('Error creating number formatter:', error);
    return getNumberFormatter(d3Format);
  }
};

