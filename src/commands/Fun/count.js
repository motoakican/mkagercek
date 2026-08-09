import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
  getCountingGameConfig,
  activateCountingGame,
  disableCountingGame,
  resetCountingGame,
  buildCountingLeaderboard,
  getCountingSystemChoices,
  getCountingSystemLabel,
  getExpectedCountValue,
} from '../../services/countingGameService.js';
import { logger } from '../../utils/logger.js';

import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
export default {
  data: new SlashCommandBuilder()
    .setName('sayi-sayma')
    .setDescription('Sunucu sayı sayma oyununu yönetir')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('kurulum')
        .setDescription('Bir metin kanalında sayı sayma oyunu başlatır')
        .addChannelOption((option) =>
          option
            .setName('kanal')
            .setDescription('Sayı saymanın yapılacağı kanal')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        )
        .addStringOption((option) =>
          option
            .setName('sistem')
            .setDescription('Kullanılacak sayı sayma sistemi')
            .setRequired(true)
            .addChoices(...getCountingSystemChoices()),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('kapat').setDescription('Bu sunucu için sayı sayma oyununu devre dışı bırakır'),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('durum').setDescription('Mevcut sayı sayma oyunu durumunu gösterir'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sifirla')
        .setDescription('Mevcut sayı sayma dizisini sıfırlar')
        .addIntegerOption((option) =>
          option
            .setName('baslangic')
            .setDescription('Sıfırlamadan sonra başlanacak sayı')
            .setMinValue(1),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('liderlik-tablosu').setDescription('Sayı sayma oyunu liderlik tablosunu gösterir'),
    ),
  category: 'Eğlence',

  async execute(interaction) {
    try {
      const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      if (!deferSuccess) {
        logger.warn('Count komutu geciktirme (defer) başarısız oldu', { userId: interaction.user.id, guildId: interaction.guildId });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine ihtiyacın var.' });
      }

      const guildId = interaction.guildId;
      const subcommand = interaction.options.getSubcommand();
      const config = await getCountingGameConfig(interaction.client, guildId);

      if (subcommand === 'kurulum') {
        const channel = interaction.options.getChannel('kanal');
        const system = interaction.options.getString('sistem');
        if (!channel || channel.type !== ChannelType.GuildText) {
          return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Lütfen sayı sayma oyunu için bir metin kanalı seç.' });
        }

        if (config.enabled && config.channelId && config.channelId !== channel.id) {
          return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Bu sunucuda zaten aktif bir sayı sayma kanalı var: <#${config.channelId}>. Önce mevcut sayı sayma oyununu devre dışı bırak veya mevcut kanalı kullan.` });
        }

        await activateCountingGame(interaction.client, guildId, channel.id, system);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Sayı Sayma Oyunu Etkinleştirildi',
              `Sayı sayma oyunu artık ${channel} kanalında **${getCountingSystemLabel(system)}** sistemiyle aktif. Oyuncular **1**'den yukarı saymalı ve arka arkaya iki sayı yazmamalıdır.`,
            ),
          ],
        });
      }

      if (subcommand === 'kapat') {
        if (!config.enabled) {
          return await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed('Sayı Sayma Oyunu Devre Dışı', 'Bu sunucu için sayı sayma oyunu zaten devre dışı bırakılmış.')],
          });
        }

        await disableCountingGame(interaction.client, guildId);
        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [successEmbed('Sayı Sayma Oyunu Devre Dışı', 'Sayı sayma oyunu devre dışı bırakıldı.')],
        });
      }

      if (subcommand === 'durum') {
        const fields = [
          { name: 'Aktif mi?', value: config.enabled ? 'Evet' : 'Hayır', inline: true },
          { name: 'Kanal', value: config.channelId ? `<#${config.channelId}>` : 'Ayarlanmadı', inline: true },
          { name: 'Sistem', value: getCountingSystemLabel(config.system), inline: true },
          { name: 'Sıradaki sayı', value: getExpectedCountValue(config), inline: true },
          { name: 'Mevcut seri', value: `${config.currentStreak}`, inline: true },
          { name: 'En iyi seri', value: `${config.bestStreak || 0}`, inline: true },
          { name: 'Son sayan', value: config.lastUserId ? `<@${config.lastUserId}>` : 'Kimse yok', inline: true },
        ];

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Sayı Sayma Oyunu Durumu',
              description: 'Şu anda yapılandırılmış olan sayı sayma oyununa genel bakış.',
              fields,
              color: 'primary',
            }),
          ],
        });
      }

      if (subcommand === 'sifirla') {
        if (!config.enabled) {
          return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Önce `/sayi-sayma kurulum` komutuyla sayı sayma oyununu etkinleştir.' });
        }

        const startNumber = interaction.options.getInteger('baslangic') || 1;
        await resetCountingGame(interaction.client, guildId, startNumber);

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            successEmbed(
              'Sayı Sayma Oyunu Sıfırlandı',
              `Sayı sayma dizisi sıfırlandı. <#${config.channelId}> kanalında tekrar **${startNumber}** ile başlayın.`,
            ),
          ],
        });
      }

      if (subcommand === 'liderlik-tablosu') {
        const leaderboard = buildCountingLeaderboard(config, interaction.guild);

        return await InteractionHelper.safeEditReply(interaction, {
          embeds: [
            createEmbed({
              title: 'Sayı Sayma Oyunu Liderlik Tablosu',
              description: leaderboard.length > 0 ? leaderboard.join('\n') : 'Henüz hiç sayı kaydedilmemiş.',
              color: 'primary',
            }),
          ],
        });
      }

      return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Lütfen geçerli bir sayı sayma oyunu eylemi seç.' });
    } catch (error) {
      logger.error('Count komutu hatası:', error);
      return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Sayı sayma oyunu yönetilirken bir şeyler yanlış gitti.' });
    }
  },
};