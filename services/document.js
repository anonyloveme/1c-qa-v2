import { createSupabaseServerClient } from "@/lib/supabase";

function normalizeQuery(query) {
  return query
    .replace(/[`~!@#$%^&*()_|+=?;:'",.<>{}\[\]\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimContext(chunks, maxCharacters) {
  const lines = [];
  let total = 0;

  for (const chunk of chunks) {
    const block = `Lesson: ${chunk.lesson || "N/A"}\nPage: ${chunk.page_number || "N/A"}\nContent:\n${chunk.content}`;
    if (total + block.length > maxCharacters && lines.length > 0) {
      break;
    }

    lines.push(block);
    total += block.length;
  }

  return lines.join("\n\n---\n\n");
}

async function runRpcSearch(supabase, query, limit) {
  const { data, error } = await supabase.rpc("search_chunks", {
    query_text: query,
    match_count: limit,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

async function runFallbackSearch(supabase, query, limit) {
  const { data: textSearchData, error: textSearchError } = await supabase
    .from("chunks")
    .select("content, page_number, lesson")
    .textSearch("content", query, {
      config: "simple",
      type: "websearch",
    })
    .limit(limit);

  if (!textSearchError && Array.isArray(textSearchData) && textSearchData.length > 0) {
    return textSearchData;
  }

  const keywordList = query
    .split(" ")
    .filter((token) => token.length > 2)
    .slice(0, 6);

  // Build OR filter so each keyword is matched independently (not as a phrase)
  const orConditions = keywordList.length > 0
    ? keywordList.map((k) => `content.ilike.%${k}%`).join(",")
    : `content.ilike.%${query}%`;

  const { data: ilikeData, error: ilikeError } = await supabase
    .from("chunks")
    .select("content, page_number, lesson")
    .or(orConditions)
    .limit(limit);

  if (ilikeError) {
    throw ilikeError;
  }

  return Array.isArray(ilikeData) ? ilikeData : [];
}

export async function searchDocumentContext(query, { useFullDocument = false } = {}) {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return {
      context: "",
      sources: [],
    };
  }

  const supabase = createSupabaseServerClient();
  const limit = useFullDocument ? 12 : 6;
  const maxCharacters = useFullDocument ? 12000 : 6000;

  let chunks = [];
  try {
    chunks = await runRpcSearch(supabase, normalizedQuery, limit);
  } catch {
    chunks = await runFallbackSearch(supabase, normalizedQuery, limit);
  }

  const cleanedChunks = chunks
    .filter((chunk) => chunk?.content)
    .map((chunk) => ({
      content: chunk.content,
      lesson: chunk.lesson,
      page_number: chunk.page_number,
    }));

  return {
    context: trimContext(cleanedChunks, maxCharacters),
    sources: cleanedChunks.map((chunk) => ({
      lesson: chunk.lesson,
      pageNumber: chunk.page_number,
    })),
  };
}