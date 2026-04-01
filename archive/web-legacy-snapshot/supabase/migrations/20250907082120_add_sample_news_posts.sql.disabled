-- Sample news posts in Polish with various Lexical formatting
-- You'll need to replace 'YOUR_ORG_ID' and 'YOUR_USER_ID' with actual values

INSERT INTO news_posts (
    title, 
    content, 
    excerpt, 
    priority, 
    badges, 
    author_id, 
    organization_id, 
    published_at, 
    created_at, 
    updated_at
) VALUES 

-- 1. Simple text message with bold and italic
(
    'Witamy w nowym systemie!',
    '{"root":{"children":[{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Witamy","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" w naszym ","type":"text","version":1},{"detail":0,"format":2,"mode":"normal","style":"","text":"nowym systemie","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" zarzdzania wiadomo[ciami! Ten system pozwoli nam na lepsz komunikacj w organizacji.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Prosimy o zapoznanie si z nowymi funkcjami i skorzystanie z mo|liwo[ci formatowania tekstu.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'Witamy w naszym nowym systemie zarzdzania wiadomo[ciami! Ten system pozwoli nam na lepsz komunikacj w organizacji.',
    'important',
    '["ogBoszenie", "aktualizacja", "nowa funkcja"]',
    '2c5067ea-9655-42a4-a78f-b1fe2d3bb281',
    '4aab690b-45c9-4150-96c2-cabe6a6d8633',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
),

-- 2. Message with headings and lists
(
    'Plan rozwoju na Q1 2024',
    '{"root":{"children":[{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Cele gBówne","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h2"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"W pierwszym kwartale 2024 roku planujemy realizacj nastpujcych celów:","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Rozwój systemu magazynowego","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - implementacja nowych funkcji inwentaryzacji","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":1},{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Integracja z systemami ksigowymi","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - poBczenie z programami finansowymi","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":2},{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Szkolenia zespoBu","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - podniesienie kompetencji pracowników","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":3}],"direction":"ltr","format":"","indent":0,"type":"list","version":1,"listType":"number","start":1},{"children":[{"detail":0,"format":2,"mode":"normal","style":"","text":"Terminy realizacji","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h3"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"SzczegóBowy harmonogram zostanie przedstawiony na najbli|szym spotkaniu zarzdu.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'W pierwszym kwartale 2024 roku planujemy realizacj nastpujcych celów: rozwój systemu magazynowego, integracja z systemami ksigowymi oraz szkolenia zespoBu.',
    'normal',
    '["planowanie", "rozwój", "cele"]',
    '2c5067ea-9655-42a4-a78f-b1fe2d3bb281',
    '4aab690b-45c9-4150-96c2-cabe6a6d8633',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
),

-- 3. Urgent message with quote and code
(
    'PILNE: Aktualizacja systemu bezpieczeDstwa',
    '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"W zwizku z wykrytymi lukami bezpieczeDstwa, ","type":"text","version":1},{"detail":0,"format":1,"mode":"normal","style":"","text":"wszystkie systemy zostan zaktualizowane dzi[ wieczorem","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":".","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":2,"mode":"normal","style":"","text":"Zgodnie z polityk bezpieczeDstwa: \"Wszystkie krytyczne aktualizacje musz by wdro|one w cigu 24 godzin od wykrycia zagro|enia.\"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Przewidywany czas niedostpno[ci: ","type":"text","version":1},{"detail":0,"format":16,"mode":"normal","style":"","text":"22:00 - 23:30","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Prosimy o zapisanie wszystkich prac przed godz. 22:00.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'PILNE: Wszystkie systemy zostan zaktualizowane dzi[ wieczorem. Przewidywany czas niedostpno[ci: 22:00 - 23:30.',
    'critical',
    '["bezpieczeDstwo", "aktualizacja", "konserwacja"]',
    '2c5067ea-9655-42a4-a78f-b1fe2d3bb281',
    '4aab690b-45c9-4150-96c2-cabe6a6d8633',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
),

-- 4. Complex message with all formatting options
(
    'Instrukcja: Jak u|ywa nowego edytora',
    '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Nowy edytor tekstu oferuje szereg mo|liwo[ci formatowania:","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Podstawowe formatowanie tekstu","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h2"},{"children":[{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Pogrubienie","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - u|ywaj do podkre[lenia wa|nych informacji","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":1},{"children":[{"detail":0,"format":2,"mode":"normal","style":"","text":"Kursywa","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - do cytatów i obcojzycznych sBów","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":2},{"children":[{"detail":0,"format":8,"mode":"normal","style":"","text":"Podkre[lenie","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - rzadko u|ywane, ale dostpne","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":3},{"children":[{"detail":0,"format":4,"mode":"normal","style":"","text":"Przekre[lenie","type":"text","version":1},{"detail":0,"format":0,"mode":"normal","style":"","text":" - do oznaczania nieaktualnych informacji","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"listitem","version":1,"value":4}],"direction":"ltr","format":"","indent":0,"type":"list","version":1,"listType":"bullet","start":1},{"children":[{"detail":0,"format":1,"mode":"normal","style":"","text":"Kod i cytaty","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h3"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Do oznaczania kodu u|ywaj formatowania: ","type":"text","version":1},{"detail":0,"format":16,"mode":"normal","style":"","text":"system.restart()","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Wa|ne uwagi mo|na umieszcza w cytatach - pomagaj one wyró|ni kluczowe informacje w dBugich tekstach.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"quote","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Mamy nadziej, |e nowy edytor uBatwi wam tworzenie czytelnych i dobrze sformatowanych wiadomo[ci!","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'Instrukcja u|ytkowania nowego edytora tekstu z opisem wszystkich dostpnych opcji formatowania.',
    'normal',
    '["instrukcja", "edytor", "funkcje", "poradnik"]',
     '2c5067ea-9655-42a4-a78f-b1fe2d3bb281',
    '4aab690b-45c9-4150-96c2-cabe6a6d8633',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
);

-- Note: You need to replace YOUR_USER_ID and YOUR_ORG_ID with actual values from your database