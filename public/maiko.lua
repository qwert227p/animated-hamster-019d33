--[[
  Maiko 1.0 — Steal an Egg reporter
  Reads YOUR OWN eggs, items and leaderstats and posts them to the Maiko dashboard.

  Usage (executor):
    getgenv().MAIKO_URL = "https://your-site.netlify.app"
    getgenv().MAIKO_KEY = "your-key"   -- optional, only if the site has MAIKO_KEY set
    loadstring(game:HttpGet(getgenv().MAIKO_URL .. "/maiko.lua"))()
]]

local env = (getgenv and getgenv()) or _G
if env.MAIKO_RUNNING then env.MAIKO_RUNNING = false; task.wait(0.2) end
env.MAIKO_RUNNING = true

local URL      = (env.MAIKO_URL or "https://animated-hamster-019d6c.netlify.app"):gsub("/+$", "")
local KEY      = env.MAIKO_KEY
local INTERVAL = env.MAIKO_INTERVAL or 20

local Players     = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local MPS         = game:GetService("MarketplaceService")
local player      = Players.LocalPlayer
local started     = os.clock()

local request = (syn and syn.request) or (http and http.request) or http_request or request or (fluxus and fluxus.request)
if not request then warn("[Maiko] Your executor has no HTTP request function."); return end

local gameName = "Steal an Egg"
pcall(function() gameName = MPS:GetProductInfo(game.PlaceId).Name end)

-- Name of the thing, stripped of rarity/mutation decorations and counts like "x3".
local function cleanName(s)
  s = tostring(s):gsub("%[.-%]", ""):gsub("%s*[xX]%d+$", ""):gsub("^%s+", ""):gsub("%s+$", "")
  return s
end
local function isEgg(name) return string.find(string.lower(name), "egg", 1, true) ~= nil end

-- Folders where games like Steal an Egg usually keep a player's inventory.
local DATA_FOLDERS = { "Data", "PlayerData", "Inventory", "Eggs", "Items", "Pets", "Backpack" }

local function collect()
  local eggs, items, seen = {}, {}, {}

  local function add(name, count, kind)
    name = cleanName(name)
    if name == "" or #name > 80 then return end
    local bucket = isEgg(name) and eggs or items
    local key = name .. "|" .. (kind or "")
    bucket[key] = bucket[key] or { name = name, count = 0, kind = kind }
    bucket[key].count += math.max(1, math.floor(tonumber(count) or 1))
  end

  -- Tools held or in the backpack
  local function scanTools(container, kind)
    if not container then return end
    for _, t in ipairs(container:GetChildren()) do
      if t:IsA("Tool") and not seen[t] then
        seen[t] = true
        local amt = t:GetAttribute("Amount") or t:GetAttribute("Count") or t:GetAttribute("Quantity")
        add(t:GetAttribute("EggName") or t:GetAttribute("ItemName") or t.Name, amt, kind)
      end
    end
  end
  scanTools(player:FindFirstChildOfClass("Backpack"), "backpack")
  scanTools(player.Character, "held")

  -- Value objects inside data folders (e.g. Data.Eggs.CommonEgg = IntValue 3)
  local function scanValues(folder, depth)
    if depth > 3 then return end
    for _, v in ipairs(folder:GetChildren()) do
      if v:IsA("IntValue") or v:IsA("NumberValue") then
        if v.Value > 0 then add(v.Name, v.Value, folder.Name:lower()) end
      elseif v:IsA("StringValue") and v.Value ~= "" and (isEgg(v.Value) or isEgg(folder.Name)) then
        add(v.Value, 1, folder.Name:lower())
      elseif v:IsA("Folder") or v:IsA("Configuration") then
        scanValues(v, depth + 1)
      end
    end
  end
  for _, n in ipairs(DATA_FOLDERS) do
    local f = player:FindFirstChild(n)
    if f and not f:IsA("Backpack") then scanValues(f, 1) end
  end

  -- Eggs sitting on your own base / plot in the world
  local function ownsPlot(plot)
    local o = plot:GetAttribute("Owner") or plot:GetAttribute("OwnerId")
    if o == player.Name or o == player.UserId or o == tostring(player.UserId) then return true end
    local ov = plot:FindFirstChild("Owner") or plot:FindFirstChild("PlotOwner")
    if ov and ov:IsA("ObjectValue") then return ov.Value == player end
    if ov and (ov:IsA("StringValue") or ov:IsA("IntValue")) then return ov.Value == player.Name or ov.Value == player.UserId end
    return false
  end
  for _, n in ipairs({ "Plots", "Bases", "PlayerBases", "Tycoons" }) do
    local root = workspace:FindFirstChild(n)
    if root then
      for _, plot in ipairs(root:GetChildren()) do
        if ownsPlot(plot) then
          for _, d in ipairs(plot:GetDescendants()) do
            if d:IsA("Model") and isEgg(d.Name) and not seen[d] then
              seen[d] = true
              add(d:GetAttribute("EggName") or d.Name, 1, "base")
            end
          end
        end
      end
    end
  end

  local function list(t) local out = {} for _, v in pairs(t) do table.insert(out, v) end return out end

  local stats = {}
  local ls = player:FindFirstChild("leaderstats")
  if ls then
    for _, v in ipairs(ls:GetChildren()) do
      if v:IsA("ValueBase") then stats[v.Name] = (typeof(v.Value) == "number") and v.Value or tostring(v.Value) end
    end
  end

  return list(eggs), list(items), stats
end

local function send()
  local eggs, items, stats = collect()
  local headers = { ["Content-Type"] = "application/json" }
  if KEY then headers["x-maiko-key"] = KEY end
  local ok, res = pcall(request, {
    Url = URL .. "/api/report",
    Method = "POST",
    Headers = headers,
    Body = HttpService:JSONEncode({
      user_id = player.UserId,
      username = player.Name,
      display_name = player.DisplayName,
      place_id = game.PlaceId,
      game_name = gameName,
      eggs = eggs,
      items = items,
      stats = stats,
      session_seconds = math.floor(os.clock() - started),
    }),
  })
  if not ok then warn("[Maiko] send failed: " .. tostring(res))
  elseif res and res.StatusCode and res.StatusCode >= 400 then warn("[Maiko] server said " .. tostring(res.StatusCode) .. " " .. tostring(res.Body)) end
end

print(("[Maiko 1.0] tracking %s → %s every %ds"):format(player.Name, URL, INTERVAL))
task.spawn(function()
  while env.MAIKO_RUNNING do
    send()
    task.wait(INTERVAL)
  end
end)
