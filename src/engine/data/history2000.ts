/**
 * Mode historique 2000 → novembre 2026 : repères de marché APPROCHÉS et chronologie d'événements réels.
 *
 * Les valeurs sont des ordres de grandeur reconstitués (clôtures de fin d'année et points de retournement
 * marquants), pas des séries officielles : entre deux repères, le moteur interpole puis ajoute sa propre
 * volatilité. Elles servent à faire vivre au joueur les grandes trajectoires (bulle Internet, 2008, crise de
 * l'euro, Covid, inflation 2022…), pas à reproduire un cours précis à la séance près.
 * Les sociétés cotées du jeu restent fictives : seules les tendances de marché et les événements sont réels.
 *
 * 2026 : repères tirés de l'actualité des marchés (guerre contre l'Iran et fermeture du détroit d'Ormuz, choc pétrolier,
 * remontée des taux, recul des valeurs de l'IA en novembre) ; pour les séries peu couvertes (émergents, banques, métaux
 * industriels, certaines devises et cryptoactifs secondaires), ce sont des estimations prudentes.
 *
 * Format d'une série : « date valeur | date valeur | … » ; une date « AAAA » seule vaut 31 décembre AAAA.
 */

export const HIST_EPOCH = 2000;
/** Dernier repère disponible : au-delà, le marché redevient entièrement simulé */
export const HIST_END = "2026-11-13";
/** Libellés de la fin des repères (affichés au joueur) */
export const HIST_END_LABEL = "13 novembre 2026", HIST_FREE_LABEL = "14 novembre 2026";

export const SERIES_SRC: Record<string, string> = {
  // ── Indices actions ──
  /** États-Unis : proche du S&P 500 */
  EQ_US: "1998 1229|1999 1469|2000-03-24 1527|2000-09-01 1520|2000 1320|2001-04-04 1103|2001-05-21 1312|2001-09-10 1093|2001-09-21 966|2001 1148|2002-03-19 1170|2002-07-23 797|2002-10-09 777|2002 880|2003-03-11 800|2003 1112|2004 1212|2005 1248|2006 1418|2007-02-27 1400|2007-07-19 1553|2007-08-15 1406|2007-10-09 1565|2007 1468|2008-03-10 1273|2008-05-19 1426|2008-07-15 1214|2008-09-12 1252|2008-09-29 1106|2008-10-10 899|2008-11-20 752|2008 903|2009-03-09 677|2009-06-30 919|2009 1115|2010-04-23 1217|2010-07-02 1022|2010 1258|2011-04-29 1364|2011-08-08 1119|2011-10-03 1099|2011 1258|2012-04-02 1419|2012-06-01 1278|2012 1426|2013 1848|2014-10-15 1862|2014 2059|2015-05-21 2131|2015-08-25 1868|2015 2044|2016-02-11 1829|2016-06-27 2000|2016-11-08 2140|2016 2239|2017 2674|2018-01-26 2873|2018-02-08 2581|2018-09-20 2931|2018-12-24 2351|2018 2507|2019 3231|2020-02-19 3386|2020-03-23 2237|2020-06-08 3232|2020 3756|2021 4766|2022-01-03 4797|2022-06-16 3667|2022-08-16 4305|2022-10-12 3577|2022 3840|2023-03-13 3855|2023-07-31 4589|2023-10-27 4117|2023 4770|2024-03-28 5254|2024-07-16 5667|2024-08-05 5186|2024 5882|2025-02-19 6144|2025-04-08 4983|2025-06-30 6205|2025-09-30 6688|2025 6845|2026-01-28 6970|2026-02-27 6880|2026-03-27 6368|2026-04-08 6760|2026-04-15 7023|2026-04-30 7210|2026-06-30 7470|2026-08-31 7700|2026-10-06 7810|2026-10-30 7580|2026-11-13 7562",
  /** Technologie américaine : proche du Nasdaq 100 */
  EQ_TECH: "1998 1836|1999 3708|2000-03-27 4704|2000 2341|2001-04-04 1573|2001-09-21 1137|2001 1577|2002-10-07 804|2002 984|2003 1468|2004 1621|2005 1645|2006 1757|2007-10-31 2238|2007 2085|2008-11-20 1036|2008 1212|2009-03-09 1043|2009 1860|2010 2218|2011 2278|2012 2661|2013 3592|2014 4236|2015 4594|2016 4864|2017 6397|2018-12-24 5899|2018 6330|2019 8733|2020-02-19 9719|2020-03-16 7020|2020 12888|2021 16320|2022-10-13 10690|2022 10939|2023 16826|2024 21012|2025-04-08 17090|2025 25250|2026-01-28 25900|2026-03-27 22900|2026-04-30 26100|2026-06-30 27600|2026-08-31 29400|2026-10-06 30900|2026-10-30 28550|2026-11-13 27944",
  /** Zone euro : proche de l'Euro Stoxx 50 */
  EQ_EZ: "1998 3342|1999 4904|2000-03-06 5464|2000 4772|2001-09-21 2877|2001 3806|2002-10-09 2150|2002 2386|2003-03-12 1850|2003 2761|2004 2951|2005 3579|2006 4120|2007-07-13 4557|2007 4400|2008-09-12 3350|2008-11-21 2165|2008 2451|2009-03-09 1810|2009 2966|2010-05-25 2490|2010 2793|2011-02-18 3068|2011-09-12 1995|2011 2317|2012-06-04 2068|2012 2636|2013 3109|2014 3146|2015-04-13 3828|2015 3268|2016-02-11 2680|2016-06-27 2697|2016 3291|2017 3504|2018 3001|2019 3745|2020-02-19 3865|2020-03-16 2386|2020 3553|2021 4298|2022-03-07 3505|2022-09-29 3280|2022 3794|2023 4522|2024 4896|2025-03-03 5540|2025-04-07 4622|2025 5750|2026-01-30 5950|2026-02-27 5900|2026-03-27 5350|2026-04-30 5900|2026-06-30 6200|2026-08-11 6560|2026-09-30 6420|2026-11-13 6389",
  /** Royaume-Uni : proche du FTSE 100 */
  EQ_UK: "1998 5883|1999 6930|2000 6223|2001-09-21 4434|2001 5217|2002 3940|2003-03-12 3287|2003 4477|2004 4814|2005 5619|2006 6221|2007 6457|2008-11-21 3781|2008 4434|2009-03-03 3512|2009 5413|2010 5900|2011 5572|2012 5898|2013 6749|2014 6566|2015 6242|2016-02-11 5537|2016 7143|2017 7688|2018 6728|2019 7542|2020-03-23 4994|2020 6461|2021 7385|2022 7452|2023 7733|2024 8173|2025-04-07 7702|2025 9850|2026-02-27 10300|2026-03-27 9700|2026-06-30 10400|2026-08-31 10600|2026-11-13 10863",
  /** Japon : proche du Nikkei 225 */
  EQ_JP: "1998 13842|1999 18934|2000-04-12 20833|2000 13786|2001 10543|2002 8579|2003-04-28 7607|2003 10677|2004 11489|2005 16111|2006 17226|2007 15308|2008-10-27 7163|2008 8860|2009-03-10 7055|2009 10546|2010 10229|2011-03-15 8605|2011 8455|2012 10395|2013 16291|2014 17451|2015 19034|2016 19114|2017 22765|2018 20015|2019 23657|2020-03-19 16553|2020 27444|2021 28792|2022 26095|2023 33464|2024-07-11 42224|2024-08-05 31458|2024 39895|2025-04-07 31136|2025 50300|2026-01-30 53500|2026-03-27 47500|2026-04-30 56000|2026-06-22 72354|2026-09-30 68000|2026-10-30 63290|2026-11-06 57435|2026-11-13 61150",
  /** Chine : proche du Hang Seng */
  EQ_CN: "1998 10049|1999 16962|2000 15096|2001 11397|2002 9321|2003 12576|2004 14230|2005 14876|2006 19965|2007-10-30 31638|2007 27813|2008-10-27 11016|2008 14387|2009 21873|2010 23035|2011 18434|2012 22657|2013 23306|2014 23605|2015 21914|2016 22001|2017 29919|2018-01-26 33154|2018 25846|2019 28190|2020 27231|2021 23398|2022-10-31 14687|2022 19781|2023 17047|2024-01-22 14961|2024 20060|2025 25600|2026-03-27 23000|2026-06-30 25500|2026-11-11 24316|2026-11-13 23638",
  /** Émergents : proche du MSCI Emerging Markets */
  EQ_EM: "1998 348|1999 567|2000 334|2001 318|2002 292|2003 442|2004 542|2005 706|2006 912|2007 1245|2008-10-27 475|2008 568|2009 989|2010 1151|2011 916|2012 1055|2013 1003|2014 956|2015 794|2016 862|2017 1158|2018 966|2019 1115|2020-03-23 758|2020 1291|2021 1232|2022 956|2023 1024|2024 1075|2025 1380|2026-03-27 1250|2026-06-30 1450|2026-10-06 1500|2026-11-13 1390",
  /** Banques de la zone euro : proche de l'Euro Stoxx Banks */
  EQ_BANK: "1998 260|1999 300|2000 330|2001 290|2002 190|2003-03-12 140|2003 240|2004 270|2005 330|2006 400|2007-04-20 460|2007 370|2008-09-12 250|2008 140|2009-03-09 70|2009 155|2010 125|2011-09-22 72|2011 85|2012-07-24 72|2012 105|2013 125|2014 140|2015 140|2016-07-06 82|2016 115|2017 130|2018 90|2019 95|2020-09-21 55|2020 70|2021 98|2022 103|2023 121|2024 148|2025 235|2026-03-27 205|2026-08-11 270|2026-11-13 262",
  // ── Matières premières (USD) ──
  GOLD: "1998 288|1999 288|2000 273|2001 279|2002 343|2003 416|2004 438|2005 513|2006 632|2007 834|2008-03-17 1000|2008-10-24 712|2008 869|2009 1088|2010 1405|2011-09-05 1895|2011 1531|2012 1664|2013-06-27 1200|2013 1202|2014 1199|2015-12-17 1050|2015 1061|2016 1146|2017 1303|2018 1279|2019 1515|2020-08-06 2067|2020 1888|2021 1806|2022-09-28 1625|2022 1812|2023 2063|2024-10-30 2790|2024 2624|2025-04-21 3420|2025-10-20 4356|2025 4330|2026-01-28 5420|2026-01-30 4900|2026-03-27 4500|2026-04-30 4700|2026-07-31 4500|2026-09-16 4300|2026-10-30 4100|2026-11-12 3975|2026-11-13 3890",
  SILV: "1998 5.0|1999 5.4|2000 4.6|2001 4.6|2002 4.7|2003 5.9|2004 6.8|2005 8.8|2006 12.9|2007 14.8|2008 11.3|2009 16.9|2010 30.6|2011-04-28 48.6|2011 28.2|2012 30.0|2013 19.5|2014 15.6|2015 13.8|2016 16.0|2017 17.0|2018 15.5|2019 17.9|2020-03-18 12.0|2020 26.4|2021 23.3|2022 24.0|2023 23.8|2024 28.9|2025 64|2026-01-29 121|2026-01-30 96|2026-03-27 76|2026-06-30 80|2026-11-13 55",
  BRENT: "1998 10.5|1999 25.5|2000-09-20 37|2000 23|2001-11-15 18|2001 19.5|2002 30|2003-03-10 34|2003-04-15 24|2003 30|2004 40|2005 58|2006 61|2007 96|2008-07-11 146|2008-12-24 36|2008 41|2009 78|2010 95|2011-04-08 126|2011 107|2012 111|2013 111|2014-06-19 115|2014 57|2015 37|2016-01-20 28|2016 56|2017 67|2018-10-03 86|2018 54|2019 66|2020-04-21 19.3|2020 52|2021 78|2022-03-08 128|2022-06-14 120|2022 86|2023 77|2024 74.6|2025-04-09 58|2025-06-19 79|2025 61|2026-02-27 72|2026-03-31 118|2026-04-07 130|2026-04-30 105|2026-06-30 95|2026-08-12 92|2026-09-14 102|2026-10-30 117|2026-11-11 92.8|2026-11-13 89",
  /** WTI exprimé en ratio du Brent (décote du brut américain 2011-2014) */
  WTI_RATIO: "1998 1.14|2010 1.0|2011-09-06 0.77|2013 0.89|2014 0.94|2016 0.98|2018 0.84|2020 0.93|2025 0.95|2026-11-11 0.93",
  NGAS: "1998 1.95|1999 2.3|2000 9.8|2001 2.6|2002 4.7|2003 6.2|2004 6.2|2005-10-05 13.4|2005 11.2|2006 6.3|2007 7.5|2008-07-02 13.3|2008 5.6|2009 5.6|2010 4.4|2011 3.0|2012-04-19 1.9|2012 3.4|2013 4.2|2014 2.9|2015 2.3|2016 3.7|2017 2.95|2018 2.9|2019 2.2|2020 2.5|2021 3.7|2022-08-22 9.3|2022 4.5|2023 2.5|2024 3.6|2025 4.0|2026-03-31 5.0|2026-11-13 4.2",
  COPR: "1998 1470|1999 1760|2000 1810|2001 1460|2002 1560|2003 2320|2004 3280|2005 4580|2006 6300|2007 6680|2008-07-02 8800|2008 2900|2009 7350|2010 9600|2011-02-14 10150|2011 7600|2012 7900|2013 7350|2014 6300|2015 4700|2016 5500|2017 7200|2018 5960|2019 6150|2020-03-23 4600|2020 7800|2021 9700|2022-03-07 10700|2022 8400|2023 8500|2024 8700|2025 11600|2026-06-30 11800|2026-11-13 11200",
  WHEA: "1998 2.8|1999 2.5|2000 2.8|2001 2.9|2002 3.3|2003 3.8|2004 3.1|2005 3.4|2006 5.0|2007 8.9|2008-02-27 12.0|2008 6.1|2009 5.4|2010 7.9|2011 6.5|2012 7.8|2013 6.05|2014 5.9|2015 4.7|2016 4.1|2017 4.3|2018 5.0|2019 5.6|2020 6.4|2021 7.7|2022-03-07 12.9|2022 7.9|2023 6.3|2024 5.5|2025 5.3|2026-04-30 6.0|2026-11-13 5.6",
  // ── Changes ──
  EURUSD: "1998 1.17|1999 1.007|2000-10-26 0.825|2000 0.94|2001 0.89|2002 1.05|2003 1.26|2004 1.36|2005 1.18|2006 1.32|2007 1.46|2008-07-15 1.60|2008-10-27 1.25|2008 1.40|2009 1.43|2010-06-07 1.19|2010 1.34|2011 1.30|2012 1.32|2013 1.38|2014 1.21|2015-03-13 1.05|2015 1.09|2016 1.05|2017 1.20|2018 1.15|2019 1.12|2020 1.22|2021 1.14|2022-09-27 0.96|2022 1.07|2023 1.10|2024 1.035|2025-07-01 1.18|2025 1.17|2026-03-27 1.12|2026-06-30 1.15|2026-11-13 1.102",
  GBPUSD: "1998 1.66|1999 1.615|2000 1.49|2001 1.455|2002 1.61|2003 1.78|2004 1.92|2005 1.72|2006 1.96|2007-11-08 2.10|2007 1.99|2008 1.46|2009 1.61|2010 1.56|2011 1.55|2012 1.62|2013 1.66|2014 1.56|2015 1.47|2016-06-23 1.48|2016-06-24 1.36|2016-10-07 1.24|2016 1.23|2017 1.35|2018 1.27|2019 1.32|2020-03-20 1.15|2020 1.37|2021 1.35|2022-09-26 1.07|2022 1.21|2023 1.27|2024 1.25|2025 1.345|2026-03-27 1.30|2026-06-30 1.33|2026-11-13 1.30",
  USDJPY: "1998 113|1999 102|2000 114|2001 131|2002 119|2003 107|2004 103|2005 118|2006 119|2007 112|2008 91|2009 93|2010 81|2011 77|2012 86|2013 105|2014 120|2015 120|2016 117|2017 113|2018 110|2019 109|2020 103|2021 115|2022-10-21 150|2022 131|2023 141|2024-07-03 161|2024 157|2025 156|2026-03-27 152|2026-11-09 157.95|2026-11-13 158",
  EURCHF: "1998 1.61|1999 1.60|2000 1.52|2001 1.48|2002 1.45|2003 1.56|2004 1.54|2005 1.56|2006 1.61|2007 1.66|2008 1.49|2009 1.48|2010 1.25|2011-08-09 1.03|2011-09-06 1.20|2011 1.21|2012 1.21|2013 1.23|2014 1.20|2015-01-14 1.20|2015-01-15 1.02|2015 1.09|2016 1.07|2017 1.17|2018 1.13|2019 1.09|2020 1.08|2021 1.04|2022 0.99|2023 0.93|2024 0.94|2025 0.93|2026-11-13 0.92",
  USDCAD: "1998 1.53|1999 1.44|2000 1.50|2001 1.59|2002 1.58|2003 1.29|2004 1.20|2005 1.16|2006 1.165|2007 0.99|2008 1.22|2009 1.05|2010 1.00|2011 1.02|2012 0.99|2013 1.06|2014 1.16|2015 1.38|2016 1.34|2017 1.26|2018 1.36|2019 1.30|2020 1.27|2021 1.26|2022 1.355|2023 1.32|2024 1.44|2025 1.38|2026-11-13 1.38",
  AUDUSD: "1998 0.61|1999 0.656|2000 0.556|2001-09-21 0.48|2001 0.51|2002 0.56|2003 0.75|2004 0.78|2005 0.73|2006 0.79|2007 0.88|2008-07-15 0.98|2008-10-27 0.61|2008 0.70|2009 0.90|2010 1.02|2011 1.02|2012 1.04|2013 0.89|2014 0.82|2015 0.73|2016 0.72|2017 0.78|2018 0.705|2019 0.70|2020-03-19 0.58|2020 0.77|2021 0.725|2022 0.68|2023 0.68|2024 0.62|2025 0.66|2026-11-13 0.64",
  USDCNY: "1998 8.28|2005-07-20 8.28|2005-07-21 8.11|2006 7.81|2007 7.30|2008 6.83|2010-06-18 6.83|2010 6.62|2011 6.30|2012 6.23|2013 6.05|2014 6.20|2015-08-10 6.21|2015-08-13 6.40|2015 6.49|2016 6.94|2017 6.51|2018 6.88|2019 6.96|2020 6.53|2021 6.36|2022 6.90|2023 7.10|2024 7.30|2025 7.05|2026-11-13 7.10",
  // ── Taux à 10 ans (%) ──
  Y10_US: "1998 4.65|1999 6.45|2000-01-20 6.79|2000 5.12|2001 5.05|2002-10-09 3.6|2002 3.82|2003-06-13 3.11|2003 4.25|2004 4.22|2005 4.39|2006 4.70|2007-06-12 5.26|2007 4.03|2008-12-18 2.08|2008 2.21|2009 3.84|2010 3.30|2011 1.88|2012-07-25 1.39|2012 1.76|2013 3.03|2014 2.17|2015 2.27|2016-07-08 1.37|2016 2.45|2017 2.41|2018-11-08 3.24|2018 2.69|2019 1.92|2020-03-09 0.54|2020-08-04 0.52|2020 0.92|2021 1.51|2022-10-21 4.24|2022 3.88|2023-10-19 4.99|2023 3.88|2024 4.57|2025-01-14 4.79|2025 4.15|2026-03-27 4.40|2026-06-30 4.50|2026-09-16 4.70|2026-10-30 4.94|2026-11-13 5.12",
  Y10_EZ: "1998 3.9|1999 5.35|2000 4.88|2001 5.0|2002 4.2|2003 4.3|2004 3.68|2005 3.31|2006 3.95|2007 4.31|2008 2.95|2009 3.39|2010 2.96|2011 1.83|2012 1.32|2013 1.93|2014 0.54|2015-04-20 0.05|2015 0.63|2016-07-08 -0.19|2016 0.21|2017 0.43|2018 0.24|2019-08-28 -0.71|2019 -0.19|2020 -0.57|2021 -0.18|2022 2.57|2023-10-03 2.97|2023 2.02|2024 2.36|2025-03-06 2.90|2025 2.85|2026-03-27 3.00|2026-06-30 3.05|2026-11-13 3.37",
  Y10_UK: "1998 4.4|1999 5.48|2000 4.88|2001 5.03|2002 4.40|2003 4.78|2004 4.54|2005 4.10|2006 4.74|2007 4.51|2008 3.02|2009 4.02|2010 3.39|2011 1.98|2012 1.83|2013 3.02|2014 1.76|2015 1.96|2016 1.24|2017 1.19|2018 1.28|2019 0.82|2020 0.20|2021 0.97|2022-09-27 4.50|2022 3.67|2023-08-17 4.75|2023 3.54|2024 4.57|2025 4.50|2026-06-30 4.70|2026-11-13 5.00",
  Y10_JP: "1998 2.0|1999 1.64|2000 1.64|2001 1.36|2002 0.90|2003-06-11 0.43|2003 1.36|2004 1.43|2005 1.47|2006 1.68|2007 1.50|2008 1.17|2009 1.30|2010 1.12|2011 0.98|2012 0.79|2013 0.74|2014 0.32|2015 0.27|2016-07-27 -0.28|2016 0.05|2017 0.05|2018 0.00|2019 -0.02|2020 0.02|2021 0.07|2022 0.42|2023 0.61|2024 1.10|2025 2.05|2026-11-13 2.30",
  Y10_CN: "1998 4.5|2000 3.5|2002 2.9|2003 3.3|2004 4.9|2005 3.3|2006 3.0|2007 4.4|2008 2.7|2009 3.6|2010 3.9|2011 3.4|2012 3.6|2013 4.6|2014 3.6|2015 2.8|2016 3.0|2017 3.9|2018 3.3|2019 3.1|2020 3.1|2021 2.8|2022 2.8|2023 2.6|2024 1.7|2025 1.85|2026-11-13 1.80",
  Y10_EM: "1998 12|2000 11|2003 8|2007 7|2008 8|2010 7|2013 7|2015 7.5|2020 5.5|2022 7.5|2025 6.8|2026-11-13 7.0",
  /** Écarts de taux souverains face à l'Allemagne (points de base) */
  SPREAD_FR: "1998 20|2007 15|2008 50|2011-11-15 190|2012 70|2014 30|2017-04-20 75|2017 35|2019 30|2020 35|2022 55|2024-06-09 50|2024-06-14 80|2024 85|2025-09-08 85|2025 70|2026-11-13 75",
  SPREAD_IT: "1998 30|2007 30|2008-12-15 140|2010-11-30 200|2011-11-09 550|2012-07-24 520|2012 320|2013 220|2014 135|2015 100|2016 160|2018-05-29 280|2018-10-19 320|2019 160|2020-03-17 270|2021 135|2022-10-13 240|2022 215|2023 170|2024 115|2025 70|2026-11-13 80",
  // ── Cryptoactifs (cotation à partir de leur apparition) ──
  /** « Aurum Chain » suit la trajectoire du premier cryptoactif (bitcoin) */
  CRY_1: "2010-07-18 0.08|2011-06-08 29.6|2011-11-18 2.0|2012 13.5|2013-04-09 230|2013-07-05 70|2013-11-30 1150|2013 750|2014 320|2015-01-14 178|2015 430|2016 960|2017-12-17 19500|2017 13800|2018-12-15 3200|2018 3700|2019-06-26 13000|2019 7200|2020-03-12 4900|2020 29000|2021-04-14 64000|2021-07-20 29800|2021-11-10 68000|2021 46300|2022-06-18 19000|2022-11-21 15800|2022 16500|2023 42300|2024-03-14 73000|2024 93400|2025-01-20 109000|2025-04-08 76300|2025-10-06 124000|2025-11-21 84000|2025 87500|2026-01-30 90000|2026-03-27 72000|2026-06-30 82000|2026-08-15 68000|2026-10-06 80000|2026-11-06 76000|2026-11-14 67234",
  /** « Nebula Network » : trajectoire des plateformes de contrats intelligents (2015 →) */
  CRY_2: "2015-08-07 2.8|2015 0.93|2016-06-17 20|2016 8|2017 750|2018-01-13 1400|2018-12-15 85|2018 133|2019 130|2020 735|2021-11-10 4800|2021 3700|2022-06-18 990|2022 1200|2023 2280|2024 3330|2025-04-08 1450|2025-08-24 4900|2025 2950|2026-03-27 2100|2026-08-15 2400|2026-11-06 2240|2026-11-14 1898",
  /** « Quanta Coin » : blockchains à haut débit (2020 →) */
  CRY_3: "2020-04-10 0.95|2020 1.5|2021-11-06 258|2021 170|2022-12-29 9.9|2022 10|2023 101|2024-11-22 260|2024 190|2025-04-07 100|2025 125|2026-11-13 95",
  /** « Helios Meme » : jetons spéculatifs (2020 →) */
  CRY_4: "2020-07-01 0.0026|2020 0.0047|2021-05-08 0.70|2021 0.17|2022 0.07|2023 0.09|2024 0.32|2025 0.13|2026-11-13 0.10",
};

/** Taux directeurs : chaque entrée = date d'effet et nouveau taux (%) */
export const POLICY_SRC: Record<"US" | "EZ" | "UK" | "JP" | "CN", string> = {
  US: "1999-11-16 5.50|2000-02-02 5.75|2000-03-21 6.00|2000-05-16 6.50|2001-01-03 6.00|2001-01-31 5.50|2001-03-20 5.00|2001-04-18 4.50|2001-05-15 4.00|2001-06-27 3.75|2001-08-21 3.50|2001-09-17 3.00|2001-10-02 2.50|2001-11-06 2.00|2001-12-11 1.75|2002-11-06 1.25|2003-06-25 1.00|2004-06-30 1.25|2004-08-10 1.50|2004-09-21 1.75|2004-11-10 2.00|2004-12-14 2.25|2005-02-02 2.50|2005-03-22 2.75|2005-05-03 3.00|2005-06-30 3.25|2005-08-09 3.50|2005-09-20 3.75|2005-11-01 4.00|2005-12-13 4.25|2006-01-31 4.50|2006-03-28 4.75|2006-05-10 5.00|2006-06-29 5.25|2007-09-18 4.75|2007-10-31 4.50|2007-12-11 4.25|2008-01-22 3.50|2008-01-30 3.00|2008-03-18 2.25|2008-04-30 2.00|2008-10-08 1.50|2008-10-29 1.00|2008-12-16 0.125|2015-12-16 0.375|2016-12-14 0.625|2017-03-15 0.875|2017-06-14 1.125|2017-12-13 1.375|2018-03-21 1.625|2018-06-13 1.875|2018-09-26 2.125|2018-12-19 2.375|2019-07-31 2.125|2019-09-18 1.875|2019-10-30 1.625|2020-03-03 1.125|2020-03-15 0.125|2022-03-16 0.375|2022-05-04 0.875|2022-06-15 1.625|2022-07-27 2.375|2022-09-21 3.125|2022-11-02 3.875|2022-12-14 4.375|2023-02-01 4.625|2023-03-22 4.875|2023-05-03 5.125|2023-07-26 5.375|2024-09-18 4.875|2024-11-07 4.625|2024-12-18 4.375|2025-09-17 4.125|2025-10-29 3.875|2025-12-10 3.625|2026-09-16 3.875",
  EZ: "1999-11-05 3.00|2000-02-04 3.25|2000-03-17 3.50|2000-04-28 3.75|2000-06-09 4.25|2000-09-01 4.50|2000-10-06 4.75|2001-05-11 4.50|2001-08-31 4.25|2001-09-18 3.75|2001-11-09 3.25|2002-12-06 2.75|2003-03-07 2.50|2003-06-06 2.00|2005-12-06 2.25|2006-03-08 2.50|2006-06-15 2.75|2006-08-09 3.00|2006-10-11 3.25|2006-12-13 3.50|2007-03-14 3.75|2007-06-13 4.00|2008-07-09 4.25|2008-10-15 3.75|2008-11-12 3.25|2008-12-10 2.50|2009-01-21 2.00|2009-03-11 1.50|2009-04-08 1.25|2009-05-13 1.00|2011-04-13 1.25|2011-07-13 1.50|2011-11-09 1.25|2011-12-14 1.00|2012-07-11 0.00|2014-06-11 -0.10|2014-09-10 -0.20|2015-12-09 -0.30|2016-03-16 -0.40|2019-09-18 -0.50|2022-07-27 0.00|2022-09-14 0.75|2022-11-02 1.50|2022-12-21 2.00|2023-02-08 2.50|2023-03-22 3.00|2023-05-10 3.25|2023-06-21 3.50|2023-08-02 3.75|2023-09-20 4.00|2024-06-12 3.75|2024-09-18 3.50|2024-10-23 3.25|2024-12-18 3.00|2025-02-05 2.75|2025-03-12 2.50|2025-04-23 2.25|2025-06-11 2.00|2026-06-11 2.25|2026-09-16 2.50",
  UK: "1999-11-04 5.50|2000-01-13 5.75|2000-02-10 6.00|2001-02-08 5.75|2001-04-05 5.50|2001-05-10 5.25|2001-08-02 5.00|2001-09-18 4.75|2001-10-04 4.50|2001-11-08 4.00|2003-02-06 3.75|2003-07-10 3.50|2003-11-06 3.75|2004-02-05 4.00|2004-05-06 4.25|2004-06-10 4.50|2004-08-05 4.75|2005-08-04 4.50|2006-08-03 4.75|2006-11-09 5.00|2007-01-11 5.25|2007-05-10 5.50|2007-07-05 5.75|2007-12-06 5.50|2008-02-07 5.25|2008-04-10 5.00|2008-10-08 4.50|2008-11-06 3.00|2008-12-04 2.00|2009-01-08 1.50|2009-02-05 1.00|2009-03-05 0.50|2016-08-04 0.25|2017-11-02 0.50|2018-08-02 0.75|2020-03-11 0.25|2020-03-19 0.10|2021-12-16 0.25|2022-02-03 0.50|2022-03-17 0.75|2022-05-05 1.00|2022-06-16 1.25|2022-08-04 1.75|2022-09-22 2.25|2022-11-03 3.00|2022-12-15 3.50|2023-02-02 4.00|2023-03-23 4.25|2023-05-11 4.50|2023-06-22 5.00|2023-08-03 5.25|2024-08-01 5.00|2024-11-07 4.75|2025-02-06 4.50|2025-05-08 4.25|2025-08-07 4.00|2025-12-18 3.75|2026-11-05 4.00",
  JP: "1999-02-12 0.02|2000-08-11 0.25|2001-03-19 0.02|2006-07-14 0.25|2007-02-21 0.50|2008-10-31 0.30|2008-12-19 0.10|2016-01-29 -0.10|2024-03-19 0.05|2024-07-31 0.25|2025-01-24 0.50|2025-12-19 0.75",
  CN: "1999-06-10 5.85|2002-02-21 5.31|2004-10-29 5.58|2006-04-28 5.85|2006-08-19 6.12|2007-03-18 6.39|2007-05-19 6.57|2007-07-21 6.84|2007-08-22 7.02|2007-09-15 7.29|2007-12-21 7.47|2008-09-16 7.20|2008-10-09 6.93|2008-10-30 6.66|2008-11-27 5.58|2008-12-23 5.31|2010-10-20 5.56|2010-12-26 5.81|2011-02-09 6.06|2011-04-06 6.31|2011-07-07 6.56|2012-06-08 6.31|2012-07-06 6.00|2014-11-22 5.60|2015-03-01 5.35|2015-05-11 5.10|2015-06-28 4.85|2015-08-26 4.60|2015-10-24 4.35|2019-08-20 4.25|2019-11-20 4.15|2020-02-20 4.05|2020-04-20 3.85|2021-12-20 3.80|2022-01-20 3.70|2022-08-22 3.65|2023-06-20 3.55|2023-08-21 3.45|2024-07-22 3.35|2024-10-21 3.10|2025-05-20 3.00",
};
export const CB_REAL_NAMES: Record<string, string> = { US: "Réserve fédérale américaine", EZ: "Banque centrale européenne", UK: "Banque d'Angleterre", JP: "Banque du Japon", CN: "Banque populaire de Chine", EM: "Banques centrales émergentes (agrégat)" };

/** Moyennes annuelles approchées 2000 → 2026 (2026 : estimations en cours d'année) : croissance du PIB, inflation, chômage (%) */
export const MACRO_YEARLY: Record<"US" | "EZ" | "UK" | "JP" | "CN" | "EM", { growth: number[]; inflation: number[]; unemployment: number[] }> = {
  US: { growth: [4.1, 1.0, 1.7, 2.8, 3.9, 3.5, 2.8, 2.0, 0.1, -2.6, 2.7, 1.6, 2.3, 2.1, 2.5, 2.9, 1.8, 2.5, 3.0, 2.5, -2.2, 6.1, 2.5, 2.9, 2.8, 2.0, 1.8], inflation: [3.4, 2.8, 1.6, 2.3, 2.7, 3.4, 3.2, 2.9, 3.8, -0.4, 1.6, 3.2, 2.1, 1.5, 1.6, 0.1, 1.3, 2.1, 2.4, 1.8, 1.2, 4.7, 8.0, 4.1, 2.9, 2.8, 3.6], unemployment: [4.0, 4.7, 5.8, 6.0, 5.5, 5.1, 4.6, 4.6, 5.8, 9.3, 9.6, 8.9, 8.1, 7.4, 6.2, 5.3, 4.9, 4.4, 3.9, 3.7, 8.1, 5.4, 3.6, 3.6, 4.0, 4.3, 4.5] },
  EZ: { growth: [3.8, 2.2, 0.9, 0.7, 2.3, 1.7, 3.2, 3.0, 0.4, -4.5, 2.1, 1.7, -0.9, -0.2, 1.4, 2.0, 1.9, 2.6, 1.8, 1.6, -6.1, 5.9, 3.5, 0.4, 0.9, 1.3, 1.0], inflation: [2.1, 2.4, 2.3, 2.1, 2.2, 2.2, 2.2, 2.1, 3.3, 0.3, 1.6, 2.7, 2.5, 1.4, 0.4, 0.2, 0.2, 1.5, 1.8, 1.2, 0.3, 2.6, 8.4, 5.4, 2.4, 2.1, 2.9], unemployment: [8.9, 8.3, 8.6, 9.0, 9.3, 9.1, 8.5, 7.5, 7.6, 9.6, 10.2, 10.2, 11.4, 12.0, 11.6, 10.9, 10.0, 9.1, 8.2, 7.6, 8.0, 7.7, 6.8, 6.6, 6.4, 6.3, 6.3] },
  UK: { growth: [3.7, 2.6, 2.1, 3.3, 2.4, 2.8, 2.6, 2.4, -0.3, -4.6, 2.2, 1.1, 1.5, 1.8, 3.2, 2.2, 1.9, 2.7, 1.4, 1.6, -10.3, 8.6, 4.8, 0.3, 1.1, 1.4, 0.9], inflation: [0.8, 1.2, 1.3, 1.4, 1.3, 2.1, 2.3, 2.3, 3.6, 2.2, 3.3, 4.5, 2.8, 2.6, 1.5, 0.0, 0.7, 2.7, 2.5, 1.8, 0.9, 2.6, 9.1, 7.3, 2.5, 3.4, 4.0], unemployment: [5.4, 5.1, 5.2, 5.0, 4.8, 4.8, 5.4, 5.3, 5.7, 7.6, 7.9, 8.1, 7.9, 7.6, 6.2, 5.4, 4.9, 4.4, 4.1, 3.8, 4.6, 4.5, 3.9, 4.0, 4.3, 4.8, 5.0] },
  JP: { growth: [2.8, 0.4, 0.0, 1.5, 2.2, 1.8, 1.4, 1.5, -1.2, -5.7, 4.1, 0.0, 1.4, 2.0, 0.3, 1.6, 0.8, 1.7, 0.6, -0.4, -4.2, 2.7, 0.9, 1.5, 0.1, 1.1, 0.6], inflation: [-0.7, -0.8, -0.9, -0.3, 0.0, -0.3, 0.3, 0.0, 1.4, -1.3, -0.7, -0.3, 0.0, 0.4, 2.7, 0.8, -0.1, 0.5, 1.0, 0.5, 0.0, -0.2, 2.5, 3.3, 2.7, 3.0, 2.6], unemployment: [4.7, 5.0, 5.4, 5.3, 4.7, 4.4, 4.1, 3.8, 4.0, 5.1, 5.1, 4.6, 4.3, 4.0, 3.6, 3.4, 3.1, 2.8, 2.4, 2.4, 2.8, 2.8, 2.6, 2.6, 2.5, 2.5, 2.6] },
  CN: { growth: [8.5, 8.3, 9.1, 10.0, 10.1, 11.4, 12.7, 14.2, 9.7, 9.4, 10.6, 9.6, 7.9, 7.8, 7.4, 7.0, 6.8, 6.9, 6.7, 6.0, 2.2, 8.4, 3.0, 5.2, 5.0, 5.0, 4.6], inflation: [0.3, 0.7, -0.8, 1.2, 3.9, 1.8, 1.5, 4.8, 5.9, -0.7, 3.3, 5.4, 2.6, 2.6, 2.0, 1.4, 2.0, 1.6, 2.1, 2.9, 2.5, 0.9, 2.0, 0.2, 0.2, 0.0, 0.6], unemployment: [3.1, 3.6, 4.0, 4.3, 4.2, 4.2, 4.1, 4.0, 4.2, 4.3, 4.1, 4.1, 4.1, 4.1, 4.1, 4.0, 4.0, 3.9, 4.9, 5.2, 5.6, 5.1, 5.6, 5.2, 5.1, 5.2, 5.2] },
  EM: { growth: [5.5, 3.5, 4.5, 6.0, 7.5, 7.0, 8.0, 8.5, 6.0, 2.8, 7.5, 6.3, 5.3, 5.0, 4.7, 4.3, 4.5, 4.8, 4.6, 3.7, -1.8, 7.0, 4.1, 4.4, 4.3, 4.2, 3.8], inflation: [8.5, 7.7, 6.9, 6.6, 5.9, 5.8, 5.6, 6.5, 9.2, 5.0, 5.6, 7.1, 5.8, 5.5, 4.7, 4.7, 4.3, 4.3, 4.8, 5.1, 5.2, 5.9, 9.8, 8.1, 7.9, 5.5, 4.8], unemployment: [7.5, 7.6, 7.8, 7.6, 7.2, 7.0, 6.7, 6.3, 6.4, 7.0, 6.7, 6.4, 6.3, 6.3, 6.2, 6.4, 6.6, 6.5, 6.4, 6.5, 7.6, 7.2, 6.3, 6.1, 6.0, 6.0, 6.0] },
};

/** Régimes de marché successifs (dates d'entrée) */
export const REGIME_TIMELINE: [string, string][] = [
  ["1999-10-01", "bulle"], ["2000-09-01", "baissier"], ["2001-03-12", "recession"], ["2001-09-11", "crise"], ["2001-10-15", "recession"], ["2002-01-15", "baissier"], ["2002-07-10", "crise"], ["2002-10-15", "baissier"],
  ["2003-03-20", "reprise"], ["2004-01-01", "expansion"], ["2006-01-01", "haussier"], ["2007-02-27", "expansion"], ["2007-08-09", "baissier"], ["2008-01-21", "recession"], ["2008-09-15", "crise"], ["2009-03-10", "reprise"],
  ["2010-01-01", "expansion"], ["2010-05-01", "baissier"], ["2010-09-01", "reprise"], ["2011-08-01", "crise"], ["2011-12-21", "baissier"], ["2012-07-26", "reprise"], ["2013-01-01", "haussier"], ["2015-08-11", "baissier"],
  ["2016-03-01", "expansion"], ["2017-01-01", "haussier"], ["2018-02-02", "expansion"], ["2018-10-03", "baissier"], ["2019-01-04", "reprise"], ["2019-06-01", "expansion"], ["2020-02-21", "crise"], ["2020-04-01", "reprise"],
  ["2020-11-09", "haussier"], ["2021-02-01", "bulle"], ["2021-11-20", "expansion"], ["2022-01-05", "baissier"], ["2022-03-01", "stagflation"], ["2022-10-14", "baissier"], ["2023-01-01", "reprise"], ["2023-03-10", "baissier"],
  ["2023-04-01", "expansion"], ["2023-11-01", "haussier"], ["2025-04-02", "crise"], ["2025-04-14", "reprise"], ["2025-06-01", "haussier"],
  ["2026-02-28", "crise"], ["2026-03-31", "stagflation"], ["2026-04-08", "reprise"], ["2026-05-15", "haussier"], ["2026-09-16", "expansion"], ["2026-11-02", "baissier"],
];

export type HistCat = "macro" | "entreprises" | "banques_centrales" | "geopolitique" | "matieres" | "marches" | "reglementation" | "crises";
/** [date, catégorie, importance (1 faible · 2 moyen · 3 majeur — met le jeu en pause), titre, texte] */
export const HIST_EVENTS: [string, HistCat, 1 | 2 | 3, string, string][] = [
  ["2000-01-03", "marches", 2, "Passage à l'an 2000 : le « bug » n'a pas eu lieu", "Les systèmes informatiques ont franchi le changement de millénaire sans incident majeur. Les valeurs Internet et télécoms atteignent des valorisations record : certaines sociétés sans bénéfice valent des dizaines de milliards."],
  ["2000-01-10", "entreprises", 2, "AOL annonce le rachat de Time Warner", "La plus grosse fusion de l'histoire (environ 165 milliards de dollars) symbolise l'euphorie de la « nouvelle économie »."],
  ["2000-03-10", "marches", 3, "Le Nasdaq atteint un sommet historique au-dessus de 5 000 points", "L'indice des valeurs technologiques a doublé en un an. Plusieurs gérants parlent d'une bulle : les introductions en bourse de « start-up » sans revenus se multiplient."],
  ["2000-04-14", "marches", 3, "Krach des valeurs technologiques : le Nasdaq perd près de 10 % en une séance", "La semaine se solde par une chute de 25 % du Nasdaq. L'éclatement de la bulle Internet commence."],
  ["2000-05-16", "banques_centrales", 2, "La Réserve fédérale relève ses taux de 50 points de base, à 6,5 %", "Alan Greenspan veut refroidir une économie en surchauffe."],
  ["2000-09-22", "macro", 2, "Intervention concertée pour soutenir l'euro", "La BCE, la Fed et la Banque du Japon achètent des euros : la monnaie unique est tombée sous 0,85 dollar."],
  ["2000-11-08", "geopolitique", 2, "Présidentielle américaine : résultat indécis en Floride", "Le duel George W. Bush - Al Gore se joue à quelques centaines de voix. Recomptages et recours devant la justice s'enchaînent."],
  ["2000-12-12", "geopolitique", 2, "La Cour suprême tranche : George W. Bush sera président des États-Unis", "Al Gore reconnaît sa défaite."],
  ["2001-01-03", "banques_centrales", 3, "Baisse surprise des taux de la Fed (−50 pb) entre deux réunions", "Face au ralentissement, la Réserve fédérale abaisse son taux à 6 %. Le début d'un cycle de baisses très rapide."],
  ["2001-03-12", "macro", 2, "Les États-Unis entrent en récession", "Investissement technologique en chute, faillites de start-up : l'économie américaine se contracte."],
  ["2001-09-11", "geopolitique", 3, "Attentats du 11 septembre à New York et Washington", "Des avions détournés frappent le World Trade Center et le Pentagone. Wall Street fermera jusqu'au 17 septembre. Compagnies aériennes, assureurs et tourisme sont en première ligne ; l'or et les emprunts d'État servent de refuges."],
  ["2001-09-17", "marches", 3, "Réouverture de Wall Street : pire semaine depuis 1933", "Le Dow Jones perd plus de 14 % sur la semaine. La Fed a baissé ses taux de 50 pb avant l'ouverture."],
  ["2001-10-07", "geopolitique", 2, "Début de l'intervention militaire en Afghanistan", "Les États-Unis et leurs alliés lancent des frappes contre les talibans."],
  ["2001-12-02", "entreprises", 3, "Faillite d'Enron", "Le géant américain de l'énergie, accusé de fraude comptable massive, dépose le bilan. La confiance dans les comptes des entreprises s'effondre ; le cabinet d'audit Arthur Andersen sera emporté."],
  ["2002-01-01", "macro", 2, "Les billets et pièces en euros entrent en circulation", "Douze pays adoptent la monnaie unique au quotidien. Le franc disparaît le 17 février."],
  ["2002-04-21", "geopolitique", 2, "Présidentielle française : Jean-Marie Le Pen qualifié pour le second tour", "Coup de tonnerre : Lionel Jospin est éliminé. Jacques Chirac sera réélu le 5 mai avec 82 % des voix."],
  ["2002-07-21", "entreprises", 3, "WorldCom fait faillite après une fraude comptable de près de 4 milliards de dollars", "Nouveau scandale après Enron : les marchés plongent. La loi Sarbanes-Oxley durcira les règles comptables."],
  ["2002-10-09", "marches", 2, "Les bourses touchent leur point bas", "Le S&P 500 a perdu près de 50 % depuis son sommet de 2000, le Nasdaq près de 80 %."],
  ["2003-03-20", "geopolitique", 3, "Début de la guerre en Irak", "Une coalition menée par les États-Unis entre en Irak. Paradoxalement, les marchés rebondissent : l'incertitude se lève."],
  ["2003-06-25", "banques_centrales", 2, "La Fed abaisse son taux à 1 %, plus bas depuis 1958", "L'argent bon marché alimentera l'essor du crédit immobilier."],
  ["2004-06-30", "banques_centrales", 2, "La Fed entame un cycle de hausses de taux", "Première hausse depuis 2000 : le taux passera de 1 % à 5,25 % en deux ans, par pas de 25 pb."],
  ["2004-11-02", "geopolitique", 1, "George W. Bush réélu président des États-Unis", ""],
  ["2004-12-26", "geopolitique", 2, "Tsunami dans l'océan Indien", "Un séisme de magnitude 9,1 provoque un tsunami dévastateur (plus de 220 000 morts). Réassureurs et tourisme asiatique sous pression."],
  ["2005-05-29", "geopolitique", 2, "Les Français rejettent le traité constitutionnel européen", "Le « non » l'emporte à 55 %. Les Pays-Bas suivent trois jours plus tard."],
  ["2005-07-21", "macro", 2, "La Chine abandonne l'ancrage fixe du yuan au dollar", "Le yuan est réévalué de 2,1 % et rattaché à un panier de devises."],
  ["2005-08-29", "matieres", 2, "L'ouragan Katrina dévaste la Nouvelle-Orléans", "Raffineries et plateformes du golfe du Mexique à l'arrêt : le pétrole et le gaz naturel flambent."],
  ["2006-06-29", "banques_centrales", 1, "La Fed porte son taux à 5,25 %", "Fin du cycle de hausses. Les prix immobiliers américains commencent à reculer."],
  ["2007-02-27", "marches", 2, "Chute de 9 % de la bourse de Shanghai, contagion mondiale", "Les inquiétudes sur le crédit immobilier à risque (« subprime ») apparaissent."],
  ["2007-05-06", "geopolitique", 1, "Nicolas Sarkozy élu président de la République", ""],
  ["2007-08-09", "crises", 3, "BNP Paribas gèle trois fonds exposés aux « subprimes »", "Les banques ne se prêtent plus entre elles : la BCE injecte 95 milliards d'euros en urgence. Début de la crise financière."],
  ["2007-09-14", "crises", 2, "Panique bancaire chez Northern Rock au Royaume-Uni", "Les épargnants font la queue pour retirer leurs dépôts. Première ruée bancaire britannique depuis plus d'un siècle."],
  ["2008-01-21", "marches", 3, "Lundi noir en Europe et en Asie", "Les bourses chutent de 5 à 7 %. La Fed baisse ses taux de 75 pb en urgence le lendemain. La Société Générale révèle 4,9 milliards d'euros de pertes de trading."],
  ["2008-03-16", "crises", 3, "Bear Stearns, au bord de la faillite, racheté par JPMorgan", "La banque d'affaires est cédée pour une fraction de sa valeur avec le soutien de la Fed."],
  ["2008-07-11", "matieres", 2, "Le pétrole atteint 147 dollars le baril", "Record historique. Il retombera sous 40 dollars en décembre."],
  ["2008-09-07", "crises", 2, "Fannie Mae et Freddie Mac placés sous tutelle de l'État américain", "Les deux géants du refinancement hypothécaire sont nationalisés de fait."],
  ["2008-09-15", "crises", 3, "Faillite de Lehman Brothers", "La quatrième banque d'affaires américaine dépose le bilan : plus de 600 milliards de dollars de dettes. Merrill Lynch est racheté par Bank of America, l'assureur AIG doit être sauvé. Le système financier mondial vacille."],
  ["2008-09-29", "crises", 3, "Le Congrès rejette le plan Paulson : Wall Street chute de 9 %", "Le plan de 700 milliards de dollars sera finalement adopté le 3 octobre."],
  ["2008-10-08", "banques_centrales", 3, "Baisse de taux coordonnée des grandes banques centrales", "Fed, BCE, Banque d'Angleterre et d'autres baissent leurs taux de 50 pb le même jour. Fortis et Dexia sont secourues."],
  ["2008-10-10", "marches", 3, "Pire semaine boursière de l'histoire récente", "Le CAC 40 et le S&P 500 perdent plus de 18 % en cinq séances. L'Islande voit ses trois banques s'effondrer."],
  ["2008-11-04", "geopolitique", 2, "Barack Obama élu président des États-Unis", ""],
  ["2008-12-11", "entreprises", 2, "Arrestation de Bernard Madoff", "Une escroquerie pyramidale d'environ 65 milliards de dollars est découverte."],
  ["2008-12-16", "banques_centrales", 3, "La Fed ramène son taux directeur entre 0 et 0,25 %", "Taux zéro et achats massifs de titres (« assouplissement quantitatif »)."],
  ["2009-03-09", "marches", 2, "Point bas des marchés : le S&P 500 a perdu 57 % depuis 2007", "Le rebond qui suit sera l'un des plus longs de l'histoire."],
  ["2009-04-02", "macro", 2, "G20 de Londres : 1 100 milliards de dollars pour relancer l'économie mondiale", ""],
  ["2010-04-20", "matieres", 2, "Explosion de la plateforme Deepwater Horizon", "La pire marée noire de l'histoire américaine dans le golfe du Mexique."],
  ["2010-05-02", "crises", 3, "Premier plan de sauvetage de la Grèce (110 milliards d'euros)", "La crise de la dette de la zone euro commence. Le 6 mai, un « flash crash » fait perdre près de 9 % à Wall Street en quelques minutes."],
  ["2010-11-28", "crises", 2, "L'Irlande obtient un plan d'aide de 85 milliards d'euros", "Le coût du sauvetage des banques irlandaises a fait exploser la dette publique."],
  ["2011-03-11", "geopolitique", 3, "Séisme, tsunami et catastrophe nucléaire de Fukushima", "Le Japon subit la pire catastrophe depuis la guerre. Le yen s'envole, le G7 intervient ; le Nikkei perd 16 % en deux séances."],
  ["2011-05-01", "geopolitique", 1, "Mort d'Oussama ben Laden", ""],
  ["2011-08-05", "crises", 3, "S&P retire aux États-Unis leur note AAA", "Première dégradation de l'histoire après une crise du plafond de la dette. Les bourses s'effondrent ; l'or dépasse 1 900 dollars."],
  ["2011-09-06", "banques_centrales", 2, "La Banque nationale suisse fixe un cours plancher de 1,20 franc pour un euro", "Le franc, valeur refuge, s'était envolé."],
  ["2011-11-09", "crises", 3, "Italie : le taux à 10 ans dépasse 7 %", "Silvio Berlusconi démissionne, Mario Draghi prend la tête de la BCE. Les banques françaises chutent."],
  ["2011-12-21", "banques_centrales", 2, "La BCE prête près de 500 milliards d'euros aux banques sur trois ans", "Premier « LTRO » géant, renouvelé en février 2012."],
  ["2012-03-09", "crises", 2, "Restructuration de la dette grecque", "Les créanciers privés acceptent une perte d'environ 50 % du nominal."],
  ["2012-05-06", "geopolitique", 1, "François Hollande élu président de la République", ""],
  ["2012-07-26", "banques_centrales", 3, "Mario Draghi : la BCE fera « tout ce qu'il faudra » pour sauver l'euro", "Une phrase qui retourne les marchés : les écarts de taux espagnols et italiens se resserrent."],
  ["2012-11-06", "geopolitique", 1, "Barack Obama réélu", ""],
  ["2013-03-25", "crises", 2, "Plan de sauvetage de Chypre avec ponction des gros dépôts", "Contrôle des capitaux, premier « bail-in » de la zone euro."],
  ["2013-04-12", "matieres", 2, "L'or plonge de 13 % en deux séances", "Fin du super-cycle des métaux précieux."],
  ["2013-05-22", "banques_centrales", 2, "« Taper tantrum » : la Fed évoque la réduction de ses achats", "Les taux longs bondissent, les devises émergentes chutent."],
  ["2014-03-18", "geopolitique", 2, "La Russie annexe la Crimée", "Sanctions occidentales ; le rouble s'effondrera en décembre."],
  ["2014-06-11", "banques_centrales", 2, "La BCE instaure un taux de dépôt négatif", "Une première pour une grande banque centrale."],
  ["2014-11-27", "matieres", 2, "L'OPEP refuse de réduire sa production : le pétrole s'effondre", "Le Brent passera de 115 dollars en juin à moins de 30 dollars début 2016."],
  ["2015-01-15", "crises", 3, "La Banque nationale suisse abandonne le cours plancher : le franc bondit de 20 %", "Choc historique sur les changes : plusieurs courtiers font faillite en quelques minutes."],
  ["2015-01-22", "banques_centrales", 2, "La BCE lance son programme d'achats de titres (60 milliards d'euros par mois)", ""],
  ["2015-07-05", "crises", 2, "Les Grecs disent « non » au référendum sur le plan d'aide", "Banques fermées, contrôle des capitaux : un troisième plan d'aide sera finalement signé."],
  ["2015-08-11", "macro", 3, "La Chine dévalue le yuan", "Le 24 août, « lundi noir » : Shanghai perd 8,5 % et les bourses mondiales décrochent."],
  ["2015-11-13", "geopolitique", 2, "Attentats de Paris", "130 morts. Les valeurs du tourisme reculent."],
  ["2015-12-16", "banques_centrales", 2, "Première hausse des taux de la Fed depuis 2006", ""],
  ["2016-06-23", "geopolitique", 3, "Le Royaume-Uni vote pour quitter l'Union européenne (Brexit)", "Le « leave » l'emporte à 52 %. La livre perd plus de 8 % en une nuit, plus bas depuis 1985 ; les banques européennes plongent."],
  ["2016-11-08", "geopolitique", 3, "Donald Trump élu président des États-Unis", "Après une chute nocturne, les marchés s'envolent sur les promesses de baisses d'impôts et de dépenses d'infrastructures."],
  ["2017-05-07", "geopolitique", 2, "Emmanuel Macron élu président de la République", "L'écart de taux France-Allemagne se resserre après la victoire face à Marine Le Pen."],
  ["2017-12-17", "marches", 2, "Le premier cryptoactif approche 20 000 dollars", "Euphorie spéculative : il perdra plus de 80 % l'année suivante."],
  ["2018-02-05", "marches", 2, "Choc de volatilité à Wall Street", "Le Dow Jones perd 1 175 points ; des produits pariant sur une volatilité faible s'effondrent."],
  ["2018-03-22", "geopolitique", 2, "Début de la guerre commerciale sino-américaine", "Washington impose des droits de douane sur les importations chinoises ; Pékin riposte."],
  ["2018-12-24", "marches", 2, "Wall Street au plus bas : le S&P 500 a perdu près de 20 % depuis septembre", "La Fed relève encore ses taux ; elle fera marche arrière en 2019."],
  ["2019-08-14", "marches", 2, "Inversion de la courbe des taux américaine", "Le 10 ans passe sous le 2 ans : signal de récession historique."],
  ["2020-01-23", "geopolitique", 2, "La Chine confine Wuhan face à un nouveau coronavirus", ""],
  ["2020-02-24", "crises", 3, "Le coronavirus se propage en Italie : les bourses décrochent", "Début du krach le plus rapide de l'histoire : −34 % en un mois pour le S&P 500."],
  ["2020-03-09", "crises", 3, "Lundi noir : guerre des prix du pétrole et pandémie", "Le Brent perd 24 % ; les bourses chutent de 7 à 8 %. Les marchés américains déclenchent leurs coupe-circuits."],
  ["2020-03-15", "banques_centrales", 3, "La Fed ramène ses taux à zéro et relance des achats massifs", "Confinements en Europe à partir du 17 mars. Les États annoncent des plans de soutien sans précédent."],
  ["2020-03-16", "marches", 3, "Le Dow Jones perd 12,9 % en une séance", "Pire séance depuis 1987. Volatilité record."],
  ["2020-04-20", "matieres", 3, "Le pétrole WTI passe sous zéro dollar", "Les stocks débordent : le contrat de mai cote −37 dollars. (Dans le jeu, les prix restent positifs.)"],
  ["2020-07-21", "macro", 2, "Plan de relance européen de 750 milliards d'euros financé par une dette commune", ""],
  ["2020-11-03", "geopolitique", 2, "Joe Biden élu président des États-Unis", ""],
  ["2020-11-09", "marches", 3, "Annonce d'un vaccin efficace à 90 % : rotation brutale vers les valeurs cycliques", "Banques, énergie et aéronautique s'envolent."],
  ["2021-01-27", "marches", 2, "Frénésie GameStop : des particuliers coalisés font plier des fonds", ""],
  ["2021-11-10", "macro", 2, "L'inflation américaine dépasse 6 %, plus haut depuis 30 ans", "Les banques centrales parlaient d'un phénomène « transitoire »."],
  ["2022-02-24", "geopolitique", 3, "La Russie envahit l'Ukraine", "Le gaz européen, le pétrole et le blé flambent. Sanctions massives contre la Russie."],
  ["2022-03-16", "banques_centrales", 2, "La Fed relève ses taux pour la première fois depuis 2018", "Début du resserrement le plus rapide depuis les années 1980 : +4,25 points en un an."],
  ["2022-04-24", "geopolitique", 1, "Emmanuel Macron réélu", ""],
  ["2022-07-27", "banques_centrales", 2, "La BCE relève ses taux pour la première fois en onze ans", "Fin des taux négatifs."],
  ["2022-09-23", "crises", 3, "Royaume-Uni : le « mini-budget » provoque un krach des gilts", "La livre touche un plus bas historique, des fonds de pension sont au bord de la rupture ; la Banque d'Angleterre intervient."],
  ["2022-11-11", "crises", 2, "Faillite de la plateforme de cryptoactifs FTX", "Les cryptoactifs plongent."],
  ["2022-11-30", "entreprises", 2, "Lancement grand public d'un assistant d'intelligence artificielle conversationnelle", "Début de l'engouement pour l'IA générative et les fabricants de puces."],
  ["2023-03-10", "crises", 3, "Faillite de la Silicon Valley Bank", "Ruée sur les dépôts d'une banque régionale américaine plombée par ses moins-values obligataires. Signature Bank suit."],
  ["2023-03-19", "crises", 3, "Credit Suisse racheté en urgence par UBS", "Les obligations subordonnées AT1 sont effacées."],
  ["2023-10-07", "geopolitique", 2, "Attaque du Hamas contre Israël", "Le pétrole et l'or progressent."],
  ["2024-03-19", "banques_centrales", 2, "La Banque du Japon met fin aux taux négatifs", "Première hausse depuis 2007."],
  ["2024-06-09", "geopolitique", 3, "Dissolution de l'Assemblée nationale en France", "Les banques françaises chutent, l'écart de taux avec l'Allemagne s'élargit."],
  ["2024-08-05", "marches", 3, "Krach éclair : le Nikkei perd 12,4 % en une séance", "Dénouement brutal des positions financées en yen (« carry trade »)."],
  ["2024-09-18", "banques_centrales", 2, "La Fed baisse ses taux de 50 pb", "Premier assouplissement depuis 2020."],
  ["2024-11-05", "geopolitique", 2, "Donald Trump élu à nouveau président des États-Unis", "Le dollar et les valeurs américaines progressent."],
  ["2024-12-04", "geopolitique", 2, "Le gouvernement Barnier renversé par une motion de censure", ""],
  ["2025-01-27", "marches", 2, "Un modèle d'IA chinois à bas coût fait chuter les valeurs des puces", "Le principal fabricant de puces pour l'IA perd près de 600 milliards de dollars de capitalisation en une séance."],
  ["2025-03-05", "macro", 2, "L'Allemagne annonce un plan massif de défense et d'infrastructures", "Le Bund connaît sa plus forte hausse de taux en une journée depuis 1990."],
  ["2025-04-02", "crises", 3, "Les États-Unis annoncent des droits de douane généralisés", "Les bourses mondiales s'effondrent pendant plusieurs jours ; une pause de 90 jours, annoncée le 9 avril, provoque un rebond historique."],
  ["2025-06-13", "geopolitique", 2, "Frappes israéliennes contre l'Iran", "Le pétrole bondit temporairement."],
  ["2025-09-08", "geopolitique", 2, "Le gouvernement Bayrou tombe après un vote de confiance", "L'écart de taux France-Allemagne se tend."],
  ["2025-10-20", "matieres", 2, "L'or dépasse 4 300 dollars l'once", "Achats des banques centrales et recherche de valeur refuge."],
  ["2025-12-19", "banques_centrales", 1, "La Banque du Japon relève son taux à 0,75 %", "Plus haut depuis 1995."],
  ["2026-01-12", "geopolitique", 2, "Iran : répression sanglante des manifestations", "La répression la plus meurtrière depuis 1979 fait monter les tensions avec les États-Unis et Israël."],
  ["2026-01-21", "geopolitique", 1, "Forum de Davos sous tension autour du Groenland", "Les ambitions américaines sur le Groenland inquiètent les Européens."],
  ["2026-01-29", "matieres", 2, "L'or dépasse 5 400 dollars et l'argent 120 dollars l'once", "Records historiques pour les métaux précieux… suivis d'une chute brutale dès le lendemain."],
  ["2026-02-28", "geopolitique", 3, "Les États-Unis et Israël frappent l'Iran", "L'Iran riposte et bloque le détroit d'Ormuz, par où transite environ un cinquième du pétrole mondial. Les marchés mondiaux plongent."],
  ["2026-03-12", "matieres", 3, "Le pétrole dépasse 100 dollars : choc énergétique", "Les exportations du Golfe s'effondrent ; le gaz flambe en Europe et en Asie."],
  ["2026-03-27", "marches", 2, "Wall Street vers son pire mois depuis 2022", "Le S&P 500 perd près de 7 % en mars ; actions, obligations et or reculent ensemble."],
  ["2026-04-07", "matieres", 2, "Le Brent au plus haut depuis 2008", "Le baril physique s'échange au-dessus de 130 dollars."],
  ["2026-04-08", "geopolitique", 3, "Cessez-le-feu entre les États-Unis et l'Iran", "Le détroit d'Ormuz rouvre sous conditions. Rebond spectaculaire des bourses : le plus fort rachat de positions vendeuses depuis 2020."],
  ["2026-04-15", "marches", 2, "Le S&P 500 franchit pour la première fois 7 000 points", "Avril devient le meilleur mois de Wall Street depuis novembre 2020. Le cessez-le-feu est prolongé le 22 avril."],
  ["2026-04-30", "macro", 2, "L'inflation au plus haut depuis trois ans", "La flambée de l'énergie se diffuse aux prix à la consommation."],
  ["2026-05-01", "matieres", 2, "Les Émirats arabes unis quittent l'OPEP", "Un coup dur pour la cohésion du cartel pétrolier."],
  ["2026-05-15", "banques_centrales", 2, "Kevin Warsh succède à Jerome Powell à la tête de la Fed", ""],
  ["2026-06-11", "banques_centrales", 2, "La BCE relève ses taux pour la première fois depuis 2023", "Taux de dépôt à 2,25 % pour contenir l'inflation importée par l'énergie."],
  ["2026-06-12", "entreprises", 2, "Introduction en bourse record de SpaceX", "75 milliards de dollars levés, la plus grosse introduction de l'histoire."],
  ["2026-06-22", "marches", 1, "Le Nikkei au sommet historique, au-dessus de 72 000 points", "Les valeurs japonaises de l'IA et des semi-conducteurs portent l'indice."],
  ["2026-08-11", "marches", 1, "L'Euro Stoxx 50 au plus haut historique", "Les actions européennes profitent de la rotation hors de la technologie américaine."],
  ["2026-08-12", "geopolitique", 2, "Nouvelles attaques dans le détroit d'Ormuz", "Les espoirs de réouverture complète s'éloignent ; le pétrole remonte."],
  ["2026-09-16", "banques_centrales", 3, "La Fed relève ses taux pour la première fois depuis 2023", "Fourchette à 3,75 %-4 % face à une inflation tenace. La BCE avait relevé son taux de dépôt à 2,50 % quelques jours plus tôt."],
  ["2026-10-06", "marches", 1, "Le S&P 500 dépasse 7 800 points", ""],
  ["2026-10-28", "banques_centrales", 1, "La Fed maintient ses taux, deux membres voulaient une hausse", ""],
  ["2026-11-03", "geopolitique", 2, "Élections de mi-mandat aux États-Unis", "Les marchés craignent un encadrement plus strict de l'intelligence artificielle."],
  ["2026-11-05", "banques_centrales", 2, "La Banque d'Angleterre relève son taux à 4 %", "Première hausse depuis 2023 ; l'inflation britannique pourrait approcher 5 % en 2027."],
  ["2026-11-06", "marches", 3, "Krach des valeurs de l'IA : le Nikkei entre en marché baissier", "Pire semaine depuis mars 2020 au Japon (−9 %) après la chute des fabricants de puces à Wall Street."],
  ["2026-11-11", "matieres", 2, "Le pétrole chute de plus de 20 % en novembre", "Le Brent revient sous 93 dollars malgré les perturbations persistantes à Ormuz."],
  ["2026-11-13", "marches", 2, "Fin des repères historiques du jeu", "L'or est retombé sous 3 900 dollars, le taux à 10 ans américain dépasse 5 %. À partir de demain, les marchés du jeu évoluent librement selon le modèle de simulation : vous écrivez la suite de l'histoire."],
];
